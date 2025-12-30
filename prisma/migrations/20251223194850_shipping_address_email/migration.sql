-- AlterTable
ALTER TABLE `shippingaddress` ADD COLUMN `email` VARCHAR(191) NULL,
    ALTER COLUMN `country` DROP DEFAULT;
