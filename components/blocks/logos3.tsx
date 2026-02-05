"use client";

import AutoScroll from "embla-carousel-auto-scroll";

import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";

interface Logo {
    id: string;
    description: string;
    image: string;
    className?: string;
}

interface Logos3Props {
    heading?: string;
    logos?: Logo[];
    className?: string;
}

const DEFAULT_LOGOS: Logo[] = [
    { id: "mls", description: "MLS", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/mls.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "nwsl", description: "NWSL", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/nwsl.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "pl", description: "Premier League", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/premier-league.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "laliga", description: "La Liga", image: "https://rddqcxfalmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/la-liga.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "bundesliga", description: "Bundesliga", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/bundesliga.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "seriea", description: "Serie A", image: "https://rddqcxfalmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/serie-a.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "ligue1", description: "Ligue 1", image: "https://rddqcxfalmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/ligue-1.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "ligamx", description: "Liga MX", image: "https://rddqcxfalmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/liga-mx.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "eredivisie", description: "Eredivisie", image: "https://rddqcxfalmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/eredivisie.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "usl", description: "USL", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/usl.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "nba", description: "NBA", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/nba.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "wnba", description: "WNBA", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/wnba.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "mlb", description: "MLB", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/mlb.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "milb", description: "MiLB", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/milb.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "nfl", description: "NFL", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/nfl.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "nhl", description: "NHL", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/nhl.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
    { id: "ipl", description: "IPL", image: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/leagues/ipl.svg", className: "h-12 w-auto grayscale brightness-0 invert opacity-50 hover:opacity-100 hover:grayscale-0 hover:brightness-100 transition-all duration-300" },
];

const Logos3 = ({
    heading = "Official League Support",
    logos = DEFAULT_LOGOS,
    className,
}: Logos3Props) => {
    return (
        <section className="py-24 overflow-hidden">
            <div className="container mx-auto px-6 mb-12">
                <div className="flex flex-col items-center text-center">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5B5FFF] mb-2">Coverage</h4>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
                        {heading}
                    </h3>
                    <p className="text-gray-500 font-medium mt-4 max-w-2xl text-sm sm:text-base">
                        Direct API and database verification for the world's premier sports organizations.
                    </p>
                </div>
            </div>
            <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white dark:from-gray-950 to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white dark:from-gray-950 to-transparent z-10" />

                <Carousel
                    opts={{ loop: true }}
                    plugins={[AutoScroll({ playOnInit: true, speed: 1.5 })]}
                    className="w-full"
                >
                    <CarouselContent className="ml-0">
                        {logos.map((logo) => (
                            <CarouselItem
                                key={logo.id}
                                className="flex basis-1/2 justify-center pl-0 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
                            >
                                <div className="mx-8 flex shrink-0 items-center justify-center">
                                    <img
                                        src={logo.image}
                                        alt={logo.description}
                                        className={logo.className}
                                    />
                                </div>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                </Carousel>
            </div>
        </section>
    );
};

export { Logos3 };
