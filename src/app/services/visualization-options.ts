// visualization-options.ts
// TypeScript version of VisualizationOptions.py
// Stores visualization settings for rendering gaze vectors on video/canvas

export class VisualizationOptions {
  color: string; // CSS color string (e.g. '#00FF00' or 'rgb(0,255,0)')
  lineThickness: number;
  lengthCoefficient: number;

  constructor(
    color: string = '#00FF00', // default green
    lineThickness: number = 4,
    lengthCoefficient: number = 5.0
  ) {
    this.color = color;
    this.lineThickness = lineThickness;
    this.lengthCoefficient = lengthCoefficient;
  }
}
