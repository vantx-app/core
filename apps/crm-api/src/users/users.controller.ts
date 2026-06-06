import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Patch,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';
import { ROLES } from 'src/common/enums/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AccessTokenPayload } from 'src/auth/types';

@Roles(ROLES.SUPER_ADMIN, ROLES.OWNER)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() createUserDto: CreateUserDto,
  ) {
    const user = req.user;
    const { orgId, ...userData } = createUserDto;
    const data: Prisma.UserCreateInput = userData;

    if (user.role !== ROLES.SUPER_ADMIN) {
      // 1. Un OWNER solo puede crear administradores (ADMIN)
      data.role = 'ADMIN';

      // 2. Forzamos que se cree dentro de su propia organización
      data.organization = {
        connect: {
          id: user.orgId,
        },
      };
    } else {
      // Si es SUPER_ADMIN, sí puede usar el orgId provisto en el DTO
      if (orgId) {
        data.organization = {
          connect: {
            id: orgId,
          },
        };
      }
    }

    return this.usersService.create(data);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: AccessTokenPayload },
    @Query('targetOrgId') targetOrgId?: string,
  ) {
    const user = req.user;
    if (user.role !== ROLES.SUPER_ADMIN) {
      return this.usersService.findAll(user.orgId);
    }
    if (targetOrgId) {
      return this.usersService.findAll(targetOrgId);
    }
    return this.usersService.findAll();
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN, ROLES.DRIVER)
  @Get('me')
  getMe(@Req() req: Request & { user: AccessTokenPayload }) {
    return this.usersService.findProfile(req.user.sub);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN, ROLES.DRIVER)
  @Post('change-password')
  changePassword(
    @Req() req: Request & { user: AccessTokenPayload },
    @Body() body: { oldPass: string; newPass: string },
  ) {
    return this.usersService.changePassword(
      req.user.sub,
      body.oldPass,
      body.newPass,
    );
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.OWNER)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
