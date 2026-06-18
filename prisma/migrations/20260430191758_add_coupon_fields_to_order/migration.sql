-- AlterTable
ALTER TABLE `Order` ADD COLUMN `couponCode` VARCHAR(191) NULL,
    ADD COLUMN `discount` DECIMAL(65, 30) NULL;
