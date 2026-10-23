import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Role } from './common/enums/role.enum';

// First-admin chicken-and-egg problem: creating a user via the API requires
// an existing admin (UsersController is admin-only), so the very first one
// has to be created out-of-band. Run with:
//   npm run create-admin -- "Admin Name" admin@example.com somepassword
async function run() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: npm run create-admin -- "<name>" <email> <password>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const usersService = app.get(UsersService);
    const user = await usersService.create({ name, email, password, role: Role.ADMIN });
    console.log(`Admin created: ${user.email} (id=${user.id})`);
  } finally {
    await app.close();
  }
}

run();
