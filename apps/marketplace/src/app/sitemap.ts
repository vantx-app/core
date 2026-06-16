import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://vantx.app/marketplace";
  const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8000";

  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
  ];

  try {
    const res = await fetch(`${apiUrl}/api/drivers/public`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const drivers = await res.json();
      if (Array.isArray(drivers)) {
        const driverRoutes = drivers.map((driver: any) => ({
          url: `${baseUrl}/drivers/${driver.id}`,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
        return [...staticRoutes, ...driverRoutes];
      }
    }
  } catch (error) {
    console.error("Error generating marketplace sitemap:", error);
  }

  return staticRoutes;
}
