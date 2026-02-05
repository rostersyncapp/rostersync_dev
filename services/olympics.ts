
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
 * Official ODF Participant Feed for Milano Cortina 2026
 */
export function convertToODF(athletes: Athlete[]): string {
    const timestamp = new Date().toISOString().split('T');
    const [date, time] = [timestamp[0], timestamp[1].split('.')[0]];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<OdfBody DocumentType="DT_PARTIC" CompetitionCode="OWG2026" FeedFlag="P" Version="1" Date="${date}" Time="${time}">\n`;
    xml += `  <Competition>\n`;

    for (const athlete of athletes) {
        const familyCaps = (athlete.lastName || athlete.fullName.split(' ').pop() || '').toUpperCase();
        const firstName = athlete.firstName || athlete.fullName.split(' ')[0] || '';
        const printName = `${familyCaps} ${firstName}`;
        const countryCode = athlete.countryCode || athlete.organisationId || 'AIN';
        const sportCode = athlete.position?.substring(0, 3).toUpperCase() || 'GEN';
        const athleteId = athlete.id.length >= 7 ? athlete.id.substring(0, 7) : athlete.id.padStart(7, '0');

        xml += `    <Participant Code="${athleteId}" Parent="${athleteId}" Status="ACTIVE" Organisation="${countryCode}" `;
        xml += `GivenName="${firstName}" FamilyName="${familyCaps}" PrintName="${familyCaps} ${firstName}" `;
        xml += `Gender="${athlete.gender || 'M'}" BirthDate="${athlete.birthDate || ''}"`;

        if (athlete.heightCm) xml += ` Height="${athlete.heightCm}"`;
        if (athlete.weightKg) xml += ` Weight="${athlete.weightKg}"`;
        if (athlete.placeOfBirth) xml += ` PlaceOfBirth="${athlete.placeOfBirth}"`;

        xml += `>\n`;
        xml += `      <Discipline Code="${sportCode}" />\n`;
        xml += `    </Participant>\n`;
    }

    xml += `  </Competition>\n</OdfBody>`;
    return xml;
}
