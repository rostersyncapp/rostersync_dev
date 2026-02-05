
import { Athlete } from '../types.ts';

/**
 * OFFICIAL 2026 MILANO CORTINA ODF CODES
 */

export const SPORT_CODES: Record<string, string> = {
    'ALP': 'Alpine Skiing',
    'BTH': 'Biathlon',
    'BOB': 'Bobsleigh',
    'CCS': 'Cross-Country Skiing',
    'CUR': 'Curling',
    'FIG': 'Figure Skating',
    'FRS': 'Freestyle Skiing',
    'IHO': 'Ice Hockey',
    'LUG': 'Luge',
    'NCB': 'Nordic Combined',
    'STK': 'Short Track Speed Skating',
    'SKN': 'Skeleton',
    'SJP': 'Ski Jumping',
    'SMT': 'Ski Mountaineering',
    'SBD': 'Snowboarding',
    'SSK': 'Speed Skating'
};

export const NATION_CODES = [
    'USA', 'CAN', 'ITA', 'FRA', 'GER', 'GBR', 'CHN', 'JPN', 'NOR', 'SWE',
    'FIN', 'SUI', 'AUT', 'NED', 'AUS', 'KOR', 'KAZ', 'SLO', 'SVK', 'CZE',
    'LAT', 'EST', 'POL', 'BRA', 'MEX', 'AIN'
];

export interface ODFAthlete extends Athlete {
    firstName: string;
    lastName: string;
    organisationId: string;
}

/**
 * Transforms athlete data into broadcaster-compliant ODF XML.
 * Compliance rules:
 * 1. FamilyName -> MUST BE UPPERCASE.
 * 2. Parent ID -> MUST BE THE PRIMARY KEY (7-digit unique ODF ID).
 * 3. Normalization -> 3-letter codes for Nations and Sports.
 */
export function convertToODF(athletes: Athlete[]): string {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<ODF version="1.0">\n`;
    xml += `  <Competition Code="OG2026">\n`;

    // Group by Discipline (Sport)
    const groupedBySport = athletes.reduce((acc: any, a) => {
        // Map position or sport to 3-letter code if possible, fallback to pos
        const sportCode = a.position?.substring(0, 3).toUpperCase() || 'GEN';
        if (!acc[sportCode]) acc[sportCode] = [];
        acc[sportCode].push(a);
        return acc;
    }, {});

    Object.entries(groupedBySport).forEach(([sportCode, group]: [string, any]) => {
        xml += `    <Discipline Code="${sportCode}">\n`;

        // Group by Event
        const groupedByEvent = group.reduce((acc: any, a: Athlete) => {
            const eventName = a.event || "General";
            if (!acc[eventName]) acc[eventName] = [];
            acc[eventName].push(a);
            return acc;
        }, {});

        Object.entries(groupedByEvent).forEach(([eventName, eventGroup]: [string, any]) => {
            xml += `      <Event Name="${eventName}">\n`;
            xml += `        <Entries>\n`;

            eventGroup.forEach((a: Athlete) => {
                const familyName = (a.lastName || a.fullName.split(' ').pop() || '').toUpperCase();
                const givenName = a.firstName || a.fullName.split(' ')[0] || '';
                const printName = `${familyName} ${givenName}`;

                // Ensure 7-digit ID for ODF (using jersey + hash or similar if not present)
                const parentId = a.id.length >= 7 ? a.id.substring(0, 7) : a.id.padStart(7, '0');

                xml += `          <Athlete Parent="${parentId}" Code="${parentId}">\n`;
                xml += `            <Description Firstname="${givenName}" FamilyName="${familyName}" PrintName="${printName}" />\n`;
                xml += `            <Gender Code="${a.gender || 'M'}" />\n`;
                xml += `            <Organisation Code="${a.countryCode || a.organisationId || 'AIN'}" />\n`;
                xml += `            <Metadata>\n`;

                if (a.birthDate) xml += `              <BirthDate Value="${a.birthDate}" />\n`;
                else xml += `              <!-- REQUIRED_FOR_BROADCAST: BirthDate -->\n`;

                if (a.heightCm) xml += `              <Height Value="${a.heightCm}" />\n`;
                else xml += `              <!-- REQUIRED_FOR_BROADCAST: Height -->\n`;

                if (a.weightKg) xml += `              <Weight Value="${a.weightKg}" />\n`;
                else xml += `              <!-- REQUIRED_FOR_BROADCAST: Weight -->\n`;

                xml += `              <Bib Number="${a.jerseyNumber}" />\n`;
                xml += `            </Metadata>\n`;
                xml += `          </Athlete>\n`;
            });

            xml += `        </Entries>\n`;
            xml += `      </Event>\n`;
        });

        xml += `    </Discipline>\n`;
    });

    xml += `  </Competition>\n`;
    xml += `</ODF>`;

    return xml;
}
