import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class UploadsService {
  private s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  private bucket = process.env.AWS_S3_BUCKET!;
  private publicBase =
    process.env.S3_PUBLIC_BASE_URL ||
    `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;

  async presign(params: { filename: string; contentType: string; folder?: string }) {
    const safeFilename = params.filename.replace(/[^\w.\-]/g, '_');
    const key = `${params.folder || 'uploads'}/${Date.now()}-${safeFilename}`;

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.contentType,
      // No pongo ACL acá por defecto (muchos buckets tienen ACLs deshabilitadas).
      // La visibilidad (público) la resolvés con CloudFront o policy.
    });

    const uploadUrl = await getSignedUrl(this.s3, cmd, { expiresIn: 60 }); // 60s
    const publicUrl = `${this.publicBase}/${key}`;

    return { uploadUrl, publicUrl, key };
  }
}
