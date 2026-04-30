-- AlterTable
ALTER TABLE `order` ADD COLUMN `couponCode` VARCHAR(191) NULL,
    ADD COLUMN `discount` DECIMAL(65, 30) NULL;
