import { IsInt, Max, Min } from 'class-validator';

export class UpdateResultWeightsDto {
  @IsInt()
  @Min(0)
  @Max(100)
  tutorialWeightPercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  finalWeightPercent: number;
}
