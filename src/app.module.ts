import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AcademicsModule } from './academics/academics.module';
import { StudentsModule } from './students/students.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ExamsModule } from './exams/exams.module';
import { NoticesModule } from './notices/notices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FinanceModule } from './finance/finance.module';
import { WebsiteModule } from './website/website.module';
import { StorageModule } from './platform/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StorageModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5433),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_DATABASE', 'school_management'),
        // Hosted Postgres providers outside the backend's own network (Neon,
        // Supabase) require SSL; Render's own Postgres over its internal
        // network, and local Docker, don't. Toggle with DB_SSL=true rather
        // than hardcoding, since the same codebase targets both.
        ssl: config.get<string>('DB_SSL', 'false') === 'true'
          ? { rejectUnauthorized: false }
          : false,
        autoLoadEntities: true,
        synchronize: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: false,
      }),
    }),
    AcademicsModule,
    StudentsModule,
    UsersModule,
    AuthModule,
    AttendanceModule,
    ExamsModule,
    NoticesModule,
    NotificationsModule,
    DashboardModule,
    FinanceModule,
    WebsiteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
