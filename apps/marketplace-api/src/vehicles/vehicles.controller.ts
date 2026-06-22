import { Controller, Get, Req } from "@nestjs/common";
import { Request } from "express";
import { VehiclesService, AccessTokenPayload } from "./vehicles.service";
import { Public } from "../common/decorators/public.decorator";

@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  async getMarketplaceListings(
    @Req() req: Request & { user: AccessTokenPayload },
  ) {
    return this.vehiclesService.findMarketplaceListings(req.user);
  }

  @Public()
  @Get("public")
  async getPublicMarketplaceListings() {
    return this.vehiclesService.findMarketplaceListings();
  }
}
