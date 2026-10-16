// Minimal typings of @nestjs/mongoose.
import { Schema as MongooseSchema } from 'mongoose';
export declare function InjectModel(name: string): ParameterDecorator;
export declare function Schema(options?: { collection?: string; timestamps?: boolean }): ClassDecorator;
export declare function Prop(options?: Record<string, unknown>): PropertyDecorator;
export declare class SchemaFactory {
  static createForClass<T>(target: abstract new (...args: never[]) => T): MongooseSchema<T>;
}
export declare class MongooseModule {
  static forRoot(uri: string | undefined): unknown;
  static forFeature(models: { name: string; schema: unknown }[]): unknown;
}
