import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  // F-06/F-07: the signed token alone used to be trusted for its whole
  // 2h lifetime, so deactivating or deleting a staff account had no
  // effect until the token happened to expire. Checked against the
  // current user record on every request instead — any failure here
  // (not found, inactive) is converted to 401 by AuthGuard's default
  // handling, same as a bad/expired token.
  async validate(payload: JwtPayload) {
    let user;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('Account no longer exists');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
