import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

// O class-validator não tem "menor que" exclusivo. Taxas de 100% ou mais tornam o
// markup divisor impossível, então a borda 1 precisa ser recusada já na entrada.
export function IsBelowOne(options?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isBelowOne',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'number' && value < 1,
        defaultMessage: (args: ValidationArguments) => `${args.property} must be less than 1`,
      },
    });
  };
}
