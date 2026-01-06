-- AlterTable
ALTER TABLE `Product` ADD COLUMN `discountMp` DOUBLE NULL,
    ADD COLUMN `discountTransfer` DOUBLE NULL,
    ADD COLUMN `freeShipping` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `isHot` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `isNew` BOOLEAN NULL DEFAULT false;
