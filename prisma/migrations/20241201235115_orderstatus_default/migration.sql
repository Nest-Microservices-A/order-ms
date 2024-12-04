/*
  Warnings:

  - You are about to drop the column `price` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Order` table. All the data in the column will be lost.
  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `totalAmount` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalItems` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "price",
DROP COLUMN "productId",
DROP COLUMN "quantity",
DROP COLUMN "userId",
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalItems" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
