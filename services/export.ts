import { Athlete, ExportFormat, SubscriptionTier } from "../types.ts";
import { convertToODF } from "./olympics.ts";
import { hexToRgb, padJersey } from "./utils.ts";

export function generateExport(
  athletes: Athlete[],
  format: ExportFormat,
  teamName: string,
  language: string = 'EN',
  tier: SubscriptionTier = 'BASIC',
  primaryColor?: string,
  secondaryColor?: string
): { content: string; filename: string; mimeType: string } {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeTeam = teamName.replace(/\s+/g, '_').toLowerCase();
  const langSuffix = language.toLowerCase();

  switch (format) {
    case 'CSV_FLAT':
      const cleanData = athletes.map(a => {
        const row: any = {
          fullName: a.fullName,
          displayNameSafe: a.displayNameSafe,
          jerseyNumber: padJersey(a.jerseyNumber),
          position: a.position,
          seasonYear: a.seasonYear,
          teamPrimaryColor: tier !== 'BASIC' ? (primaryColor || '') : '',
          teamSecondaryColor: tier !== 'BASIC' ? (secondaryColor || '') : '',
          teamPrimaryRGB: (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : '',
          teamSecondaryRGB: (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : ''
        };
        if (tier !== 'BASIC') {
          row.phonetic = a.phoneticSimplified;
          if (tier === 'NETWORK') {
            row.phoneticIPA = a.phoneticIPA;
          }
        }
        return row;
      });

      return {
        content: convertToCSV(cleanData),
        filename: `${safeTeam}_roster_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'ICONIK_JSON':
      const slugTeam = teamName.replace(/\s+/g, '-').toLowerCase();
      // Format equivalent to Iconik's ISO format
      const nowIso = new Date().toISOString().replace('Z', '+00:00');
      const iconikMetadata: any = {
        "auto_set": true,
        "date_created": nowIso,
        "date_modified": nowIso,
        "description": `Athlete Metadata`,
        "external_id": null,
        "field_type": "drop_down",
        "hide_if_not_set": false,
        "is_block_field": true,
        "is_warning_field": false,
        "label": teamName,
        "mapped_field_name": null,
        "max_value": 0.0,
        "min_value": 0.0,
        "multi": true,
        "name": slugTeam,
        "options": [...athletes].sort((a, b) => {
          const getLN = (n: string) => n.trim().split(/\s+/).pop() || "";
          const lnA = getLN(a.fullName).toLowerCase();
          const lnB = getLN(b.fullName).toLowerCase();
          return lnA !== lnB ? lnA.localeCompare(lnB) : a.fullName.localeCompare(b.fullName);
        }).map(a => ({
          "label": `${padJersey(a.jerseyNumber)} - ${a.fullName}`,
          "value": a.fullName
        })),
        "read_only": false,
        "representative": true,
        "required": false,
        "sortable": true,
        "source_url": null,
        "use_as_facet": true
      };

      if (tier !== 'BASIC') {
        iconikMetadata.custom_metadata = {
          "primaryColor": primaryColor || "",
          "secondaryColor": secondaryColor || "",
          "primaryRGB": (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : "",
          "secondaryRGB": (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : "",
          "seasonYear": athletes[0]?.seasonYear || ""
        };
      }

      return {
        content: JSON.stringify(iconikMetadata, null, 2),
        filename: `${safeTeam}_iconik_${langSuffix}_${timestamp}.json`,
        mimeType: 'application/json'
      };


    case 'VIZRT_DATACENTER_CSV':
      const vizHeaders = ["KEY", "ID", "NAME", "POS", "PHONETIC", "COLOR_PRI", "COLOR_SEC", "RGB_PRI", "RGB_SEC", "BIO_JSON"];
      const vizRows = athletes.map(a => {
        const bioData = {
          status: a.nilStatus,
          season: a.seasonYear,
          stats: a.bioStats || "",
          handle: a.socialHandle || ""
        };
        return [
          padJersey(a.jerseyNumber),
          a.displayNameSafe.toUpperCase(),
          a.position.toUpperCase(),
          tier === 'NETWORK' ? a.phoneticIPA : a.phoneticSimplified || "",
          tier !== 'BASIC' ? (primaryColor || "") : "",
          tier !== 'BASIC' ? (secondaryColor || "") : "",
          (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : "",
          (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : "",
          JSON.stringify(bioData).replace(/"/g, '""')
        ].map(val => `"${val}"`).join(",");
      });

      return {
        content: [vizHeaders.join(","), ...vizRows].join("\n"),
        filename: `${safeTeam}_vizrt_datacenter_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'VIZRT_XML':
      let vxml = `<?xml version="1.0" encoding="UTF-8"?>\n<tickerfeed version="2.4">\n  <playlist name="TeamRoster" type="scrolling_carousel" target="pool">\n`;
      athletes.forEach(a => {
        vxml += `    <element>\n`;
        vxml += `      <field name="ID">${padJersey(a.jerseyNumber)}</field>\n`;
        vxml += `      <field name="NAME_CAPS">${a.displayNameSafe.toUpperCase()}</field>\n`;
        vxml += `      <field name="POSITION">${a.position.toUpperCase()}</field>\n`;
        vxml += `      <field name="PRONUNCIATION">${(tier === 'NETWORK' ? a.phoneticIPA : a.phoneticSimplified) || ''}</field>\n`;
        vxml += `      <field name="PRIMARY_COLOR">${tier !== 'BASIC' ? (primaryColor || '') : ''}</field>\n`;
        vxml += `      <field name="SECONDARY_COLOR">${tier !== 'BASIC' ? (secondaryColor || '') : ''}</field>\n`;
        vxml += `      <field name="PRIMARY_RGB">${(tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : ''}</field>\n`;
        vxml += `      <field name="SECONDARY_RGB">${(tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : ''}</field>\n`;
        vxml += `      <field name="SEASON_YEAR">${a.seasonYear || ''}</field>\n`;
        vxml += `      <field name="STAT_LINE">${a.bioStats || ''}</field>\n`;
        vxml += `      <field name="HEADSHOT_URL">C:\\RosterData\\Heads\\${padJersey(a.jerseyNumber)}.tga</field>\n`;
        vxml += `    </element>\n`;
      });
      vxml += `  </playlist>\n</tickerfeed>`;
      return {
        content: vxml,
        filename: `${safeTeam}_vizrt_ticker_${langSuffix}_${timestamp}.xml`,
        mimeType: 'application/xml'
      };

    case 'CHYRON_CSV':
      const chyronHeaders = ["Index", "PlayerName", "PlayerNumber", "PositionAbbr", "Phonetic", "PrimaryColor", "SecondaryColor", "PrimaryRGB", "SecondaryRGB", "SeasonYear", "Bio_Stats", "SocialHandle"];
      const chyronRows = athletes.map((a, idx) => [
        idx + 1,
        a.fullName,
        padJersey(a.jerseyNumber),
        a.position.toUpperCase(),
        tier !== 'BASIC' ? a.phoneticSimplified || "" : "",
        tier !== 'BASIC' ? (primaryColor || "") : "",
        tier !== 'BASIC' ? (secondaryColor || "") : "",
        (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : "",
        (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : "",
        a.seasonYear || "",
        a.bioStats || "Production ready bio summary pending.",
        a.socialHandle || `@${a.fullName.toLowerCase().replace(/\s+/g, '')}`
      ].map(val => `"${val}"`).join(","));

      return {
        content: [chyronHeaders.join(","), ...chyronRows].join("\n"),
        filename: `${safeTeam}_chyron_prime_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'NEWBLUE_CSV':
      const newBlueHeaders = ["Title", "Subtitle", "Description", "PrimaryColor", "SecondaryColor", "PrimaryRGB", "SecondaryRGB", "Season", "Image_URL"];
      const newBlueRows = athletes.map(a => [
        a.fullName,
        `${a.position} | #${padJersey(a.jerseyNumber)}`,
        a.bioStats || `${a.fullName} is an ${a.nilStatus} athlete for ${teamName}.`,
        tier !== 'BASIC' ? (primaryColor || "") : "",
        tier !== 'BASIC' ? (secondaryColor || "") : "",
        (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : "",
        (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : "",
        a.seasonYear || "",
        ""
      ].map(val => `"${val}"`).join(","));

      return {
        content: [newBlueHeaders.join(","), ...newBlueRows].join("\n"),
        filename: `${safeTeam}_newblue_titler_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'TAGBOARD_CSV':
      // Tagboard DDG (Data Driven Graphics) format
      // Requires simple headers in Row 1.
      // Image URLs must be direct links.
      const tagboardHeaders = ["Name", "Jersey", "Position", "Phonetic", "PrimaryColor", "SecondaryColor", "PrimaryRGB", "SecondaryRGB", "Season", "Team Name", "Headshot URL", "Team Logo URL"];

      // We look for Branding metadata in the first athlete or pass it in if available in future refactors.
      // For now, we assume the logo might be attached to individual athletes if we enriched them, 
      // or we just leave it blank if not available at the athlete level.
      // Ideally, team logo should come from the teamMetadata, but this function signature takes athletes array.
      // We will leave Team Logo URL blank for now unless we can get it from a prop, 
      // but headshots are usually constructed from ESPN IDs or similar if we had them.
      // Since we don't store headshot URLs on the athlete object explicitly yet (only constructed in UI),
      // we will output blank or constructed URLs if we add that field.
      // For this initial implementation, we map what we have.

      const tagboardRows = athletes.map(a => [
        a.fullName,
        padJersey(a.jerseyNumber),
        a.position,
        tier !== 'BASIC' ? a.phoneticSimplified || "" : "",
        tier !== 'BASIC' ? (primaryColor || "") : "",
        tier !== 'BASIC' ? (secondaryColor || "") : "",
        (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : "",
        (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : "",
        a.seasonYear || "",
        teamName,
        // TODO: Add headshot logic if readily available. 
        // For now, use a placeholder or blank to avoid breaking the CSV if the user maps it manually.
        "",
        ""
      ].map(val => `"${val}"`).join(","));

      return {
        content: [tagboardHeaders.join(","), ...tagboardRows].join("\n"),
        filename: `${safeTeam}_tagboard_ddg_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'CATDV_JSON':
      const catdvData = {
        "fieldGroupID": 1,
        "memberOf": "clip",
        "identifier": "player.names",
        "name": "Player Names",
        "fieldType": "picklist",
        "values": [...athletes].sort((a, b) => {
          const getLN = (n: string) => n.trim().split(/\s+/).pop() || "";
          const lnA = getLN(a.fullName).toLowerCase();
          const lnB = getLN(b.fullName).toLowerCase();
          return lnA !== lnB ? lnA.localeCompare(lnB) : a.fullName.localeCompare(b.fullName);
        }).map(a => a.fullName),
        "isExtensible": true,
        "isKeptSorted": true,
        "savesValues": true,
        "isLocked": false
      };

      return {
        content: JSON.stringify(catdvData, null, 2),
        filename: `${safeTeam}_catdv_${langSuffix}_${timestamp}.json`,
        mimeType: 'application/json'
      };

    case 'ROSS_XML':
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ROSTER TEAM="${teamName.toUpperCase()}" LANGUAGE="${language.toUpperCase()}" SEASON="${(athletes[0]?.seasonYear || '').toUpperCase()}">\n`;
      if (tier !== 'BASIC') {
        const pRgb = (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : "";
        const sRgb = (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : "";
        xml += `  <COLORS PRIMARY="${primaryColor || ''}" SECONDARY="${secondaryColor || ''}" PRIMARY_RGB="${pRgb}" SECONDARY_RGB="${sRgb}" />\n`;
      }
      athletes.forEach(a => {
        xml += `  <ATHLETE ID="${a.id}">\n`;
        xml += `    <NAME>${a.displayNameSafe}</NAME>\n`;
        xml += `    <JERSEY>${padJersey(a.jerseyNumber)}</JERSEY>\n`;
        xml += `    <POSITION>${a.position.toUpperCase()}</POSITION>\n`;
        xml += `    <STATUS>${a.nilStatus.toUpperCase()}</STATUS>\n`;
        if (tier !== 'BASIC') {
          xml += `    <PHONETIC>${a.phoneticSimplified || ''}</PHONETIC>\n`;
          xml += `    <COLOR_PRIMARY>${primaryColor || ''}</COLOR_PRIMARY>\n`;
          xml += `    <COLOR_SECONDARY>${secondaryColor || ''}</COLOR_SECONDARY>\n`;
          xml += `    <RGB_PRIMARY>${(tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : ''}</RGB_PRIMARY>\n`;
          xml += `    <RGB_SECONDARY>${(tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : ''}</RGB_SECONDARY>\n`;
          xml += `    <SEASON_YEAR>${a.seasonYear || ''}</SEASON_YEAR>\n`;
        }
        xml += `  </ATHLETE>\n`;
      });
      xml += `</ROSTER>`;
      return {
        content: xml,
        filename: `${safeTeam}_ross_${langSuffix}_${timestamp}.xml`,
        mimeType: 'application/xml'
      };

    case 'VIZRT_JSON':
      const vizrtData: any = {
        team: teamName,
        players: athletes.map(a => {
          const safeImgName = a.displayNameSafe.toLowerCase().replace(/\s+/g, '_');
          const number = parseInt(a.jerseyNumber);
          return {
            id: a.id,
            name: a.fullName,
            number: padJersey(a.jerseyNumber),
            pos: a.position,
            season: a.seasonYear,
            img: `${safeImgName}_cutout.png`
          };
        })
      };
      if (tier !== 'BASIC') {
        vizrtData.colors = {
          primary: primaryColor || '',
          secondary: secondaryColor || '',
          primaryRGB: (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(primaryColor) : '',
          secondaryRGB: (tier === 'STUDIO' || tier === 'NETWORK') ? hexToRgb(secondaryColor) : ''
        };
      }
      return {
        content: JSON.stringify(vizrtData, null, 2),
        filename: `${safeTeam}_vizrt_${langSuffix}_${timestamp}.json`,
        mimeType: 'application/json'
      };

    case 'ODF_XML':
      const odfContent = convertToODF(athletes, primaryColor, secondaryColor, tier);
      return {
        content: odfContent,
        filename: `${safeTeam}_odf_2026_${langSuffix}_${timestamp}.xml`,
        mimeType: 'application/xml'
      };

    default:
      throw new Error("Unsupported format");
  }
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(","));
  return [headers, ...rows].join("\n");
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
