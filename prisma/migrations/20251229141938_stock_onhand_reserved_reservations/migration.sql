/*
  Warnings:

  - You are about to alter the column `status` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `Enum(EnumId(1))`.
  - You are about to drop the column `stock` on the `ProductVariant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[checkoutToken]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `ProductVariant_productId_stock_idx` ON `ProductVariant`;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cancelReason` VARCHAR(191) NULL,
    ADD COLUMN `checkoutToken` VARCHAR(64) NULL,
    ADD COLUMN `reservedUntil` DATETIME(3) NULL,
    MODIFY `status` ENUM('CREATED', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE `ProductVariant` DROP COLUMN `stock`,
    ADD COLUMN `onHand` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reserved` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `StockReservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `guestSessionToken` VARCHAR(128) NULL,
    `status` ENUM('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockReservation_orderId_key`(`orderId`),
    INDEX `StockReservation_status_expiresAt_idx`(`status`, `expiresAt`),
    INDEX `StockReservation_guestSessionToken_idx`(`guestSessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockReservationItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservationId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `StockReservationItem_variantId_idx`(`variantId`),
    UNIQUE INDEX `StockReservationItem_reservationId_variantId_key`(`reservationId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Order_checkoutToken_key` ON `Order`(`checkoutToken`);

-- CreateIndex
CREATE INDEX `ProductVariant_productId_onHand_idx` ON `ProductVariant`(`productId`, `onHand`);

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservationItem` ADD CONSTRAINT `StockReservationItem_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `StockReservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservationItem` ADD CONSTRAINT `StockReservationItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
