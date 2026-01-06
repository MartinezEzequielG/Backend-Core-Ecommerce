-- AlterTable
ALTER TABLE `StoreSettings` ADD COLUMN `documentNumber` VARCHAR(191) NULL,
    ADD COLUMN `documentType` VARCHAR(191) NULL,
    ADD COLUMN `ownerEmail` VARCHAR(191) NULL,
    ADD COLUMN `ownerFullName` VARCHAR(191) NULL,
    ADD COLUMN `ownerPhone` VARCHAR(191) NULL;
