import { Role } from '@prisma/client';

export class UserWithoutPassword {
  id: string;
  email: string;
  role: Role;
  orgId: string | null;
}
