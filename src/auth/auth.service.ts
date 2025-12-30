import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async register(data: RegisterDto) {
    // delega hashing/unique en UsersService
    const user = await this.usersService.createUser(data);
    const { password, ...userSafe } = user as any;
    return userSafe;
  }
}
