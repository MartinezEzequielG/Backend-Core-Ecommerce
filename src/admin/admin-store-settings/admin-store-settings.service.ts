import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminStoreSettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.storeSettings.findFirst();
    // Devuelve un objeto vacío si no hay registro
    return settings ?? {
      name: '',
      address: '',
      whatsappNumber: '',
      contactEmail: '',
      ownerPhone: '',
      ownerFullName: '',
      ownerEmail: '',
      documentType: '',
      documentNumber: '',
      currency: 'ARS',
    };
  }

  async update(data: Partial<any>) {
    // Lista de campos válidos
    const allowedFields = [
      'name',
      'logoUrl',
      'primaryColor',
      'secondaryColor',
      'contactEmail',
      'currency',
      'whatsappNumber',
      'address',
      'ownerFullName',
      'ownerPhone',
      'ownerEmail',
      'documentType',
      'documentNumber',
    ];

    // Filtra solo los campos válidos
    const filteredData: any = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }

    return this.prisma.storeSettings.upsert({
      where: { id: 1 },
      update: filteredData,
      create: {
        id: 1,
        name: filteredData.name ?? 'Nombre de la tienda',
        logoUrl: filteredData.logoUrl ?? null,
        primaryColor: filteredData.primaryColor ?? null,
        secondaryColor: filteredData.secondaryColor ?? null,
        contactEmail: filteredData.contactEmail ?? null,
        currency: filteredData.currency ?? 'ARS',
        whatsappNumber: filteredData.whatsappNumber ?? null,
        address: filteredData.address ?? null,
        ownerFullName: filteredData.ownerFullName ?? null,
        ownerPhone: filteredData.ownerPhone ?? null,
        ownerEmail: filteredData.ownerEmail ?? null,
        documentType: filteredData.documentType ?? null,
        documentNumber: filteredData.documentNumber ?? null,
      },
    });
  }
}