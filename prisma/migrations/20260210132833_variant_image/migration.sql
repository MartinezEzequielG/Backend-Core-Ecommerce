-- AlterTable
ALTER TABLE `productvariant` ADD COLUMN `imageId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `ProductVariant_imageId_idx` ON `ProductVariant`(`imageId`);

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `ProductImage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
