export class CalculationService {
  static calculateFinalLoad(
    currentReading: number,
    initialReading: number,
    gaugeFactor: number
  ): number {
    return (currentReading - initialReading) * gaugeFactor;
  }

  static calculateDigits(currentReading: number): number {
    return (currentReading * currentReading) / 1000;
  }

  static convertCelsiusToFahrenheit(celsius: number): number {
    return (celsius * 9) / 5 + 32;
  }

  static convertFahrenheitToCelsius(fahrenheit: number): number {
    return ((fahrenheit - 32) * 5) / 9;
  }

  static convertCelsiusToKelvin(celsius: number): number {
    return celsius + 273.15;
  }

  static convertKelvinToCelsius(kelvin: number): number {
    return kelvin - 273.15;
  }

  static formatNumber(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  }

  static formatTimestamp(date: Date): string {
    return date.toISOString();
  }
}
