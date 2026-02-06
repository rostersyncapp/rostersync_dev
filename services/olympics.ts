
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
    'FSK': 'Figure Skating',
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
 * Official ODF Participant Feed for Milano Cortina 2026 (DT_PARTIC)
 */
export function convertToODF(athletes: Athlete[], primaryColor?: string, secondaryColor?: string): string {
    const timestamp = new Date().toISOString().split('T');
    const [date, time] = [timestamp[0], timestamp[1].split('.')[0]];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    // CompetitionCode="OWG2026" is mandatory for Milano Cortina 2026
    xml += `<OdfBody DocumentType="DT_PARTIC" CompetitionCode="OWG2026" FeedFlag="P" Version="1" Date="${date}" Time="${time}">\n`;
    xml += `  <Competition>\n`;

    for (const athlete of athletes) {
        // Broadcaster Rule: FamilyName MUST be UPPERCASE
        const familyName = (athlete.lastName || '').toUpperCase();
        const firstName = athlete.firstName || '';

        // Broadcaster Rule: Code and Parent MUST be the official CompetitorCode (parent_id)
        const athleteId = athlete.id;

        // Broadcaster Rule: PrintName MUST match the DB exactly
        const printName = athlete.fullName;

        const countryCode = athlete.organisationId || 'AIN';
        const sportCode = athlete.sportCode || athlete.position?.substring(0, 3).toUpperCase() || 'GEN';

        // Custom Padding Logic for ODF
        const padJersey = (n: string) => {
            const s = String(n).replace(/[^0-9]/g, '');
            return s ? s.padStart(2, '0') : n;
        };

        xml += `    <Participant Code="${athleteId}" Parent="${athleteId}" Status="ACTIVE" Organisation="${countryCode}" `;
        xml += `GivenName="${firstName}" FamilyName="${familyName}" PrintName="${printName}" `;
        xml += `Gender="${athlete.gender || 'M'}" BirthDate="${athlete.birthDate || ''}" `;
        xml += `Jersey="${padJersey(athlete.jerseyNumber)}" `;

        if (primaryColor) xml += `PrimaryColor="${primaryColor}" `;
        if (secondaryColor) xml += `SecondaryColor="${secondaryColor}" `;

        if (athlete.heightCm) xml += `Height="${athlete.heightCm}" `;
        if (athlete.weightKg) xml += `Weight="${athlete.weightKg}" `;
        if (athlete.placeOfBirth) xml += `PlaceOfBirth="${athlete.placeOfBirth}"`;

        xml += `>\n`;
        xml += `      <Discipline Code="${sportCode}" />\n`;
        xml += `    </Participant>\n`;
    }

    xml += `  </Competition>\n</OdfBody>`;
    return xml;
}
