import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/pagination-order.dto';
import { ChangeOrderStatusDto } from './dto';
import { NATS_SERVER, PRODUCT_SERVICE } from 'src/config/services';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  constructor(
    @Inject(NATS_SERVER) private readonly productsClient: ClientProxy,
  ) {
    super();
  }
  private readonly logger = new Logger('OrdersService');

  onModuleInit() {
    this.$connect();
    this.logger.log('Connected to database');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      //1 Confirmar los ids de los productos
      const productIds = createOrderDto.items.map((item) => item.productId);
      const products: any[] = await firstValueFrom(
        this.productsClient.send({ cmd: 'validate_products' }, productIds),
      );

      //2. Cálculos de los valores
      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const price = products.find(
          (product) => product.id === orderItem.productId,
        ).price;
        return price * orderItem.quantity;
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0);

      //3. Crear una transacción de base de datos
      const order = await this.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                price: products.find(
                  (product) => product.id === orderItem.productId,
                ).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name: products.find((product) => product.id === orderItem.productId)
            .name,
        })),
      };
    } catch (error) {
      throw new RpcException({
        message: 'Error creating product: ' + error.message,
        status: error?.error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    try {
      const { page, limit } = orderPaginationDto;

      const totalPage = await this.order.count({
        where: {
          status: orderPaginationDto.status,
        },
      });
      const lastPage = Math.ceil(totalPage / limit);

      return {
        data: await this.order.findMany({
          skip: (page - 1) * limit,
          take: limit,
          where: {
            status: orderPaginationDto.status,
          },
        }),
        meta: {
          total: totalPage,
          page: page,
          lastPage: lastPage,
        },
      };
    } catch (error) {
      throw new RpcException({
        message: 'Error finding all orders: ' + error.message,
        status: error?.error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async findOne(id: string) {
    try {
      const order = await this.order.findFirst({
        where: { id },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });

      if (!order) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Order with id ${id} not found`,
        });
      }

      const productIds = order.OrderItem.map(
        (orderItem) => orderItem.productId,
      );
      const products: any[] = await firstValueFrom(
        this.productsClient.send({ cmd: 'validate_products' }, productIds),
      );

      return {
        ...order,
        OrderItem: order.OrderItem.map((orderItem) => ({
          ...orderItem,
          name: products.find((product) => product.id === orderItem.productId)
            .name,
        })),
      };
    } catch (error) {
      console.log('error', error);
      throw new RpcException({
        message: 'Error finding one order: ' + error.message,
        status: error?.error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);
    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: { id },
      data: { status: status },
    });
  }
}
