import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAutorisationDto } from './dto/create-autorisation.dto.js';
import { SignerAutorisationDto } from './dto/signer-autorisation.dto.js';

@Injectable()
export class AutorisationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAutorisationDto, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: dto.sejourId },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    return this.prisma.autorisationParentale.create({
      data: {
        sejourId: dto.sejourId,
        eleveNom: dto.eleveNom,
        elevePrenom: dto.elevePrenom,
        parentEmail: dto.parentEmail,
      },
    });
  }

  async getByToken(token: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
      include: {
        sejour: {
          select: {
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
          },
        },
      },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');

    return {
      eleveNom: autorisation.eleveNom,
      elevePrenom: autorisation.elevePrenom,
      signeeAt: autorisation.signeeAt,
      sejour: autorisation.sejour,
    };
  }

  async signer(token: string, dto: SignerAutorisationDto) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.signeeAt)
      throw new ConflictException('Cette autorisation a déjà été signée');

    return this.prisma.autorisationParentale.update({
      where: { tokenAcces: token },
      data: {
        signeeAt: new Date(),
        infosMedicales: dto.infosMedicales ?? null,
      },
    });
  }

  async getBySejour(sejourId: string, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    return this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
