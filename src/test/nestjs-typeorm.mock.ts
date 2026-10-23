// Jest-only stand-in for @nestjs/typeorm. The real package ships pure ESM
// with `import.meta.url` in its CJS-incompatible way, which Jest's default
// CJS runtime can't load regardless of transform config. Every service in
// this app only uses @InjectRepository (a parameter decorator, metadata-only
// at runtime) and TypeOrmModule (only referenced from *.module.ts files,
// never loaded by a plain unit test that constructs a service directly) —
// so a no-op stub is enough for tests; the real app still uses the real
// package via ts-node/nest build, completely separate from Jest.
export function InjectRepository(_entity: unknown): ParameterDecorator {
  return () => undefined;
}

export class TypeOrmModule {
  static forFeature() {
    return { module: TypeOrmModule, providers: [], exports: [] };
  }
  static forRootAsync() {
    return { module: TypeOrmModule, providers: [], exports: [] };
  }
}
