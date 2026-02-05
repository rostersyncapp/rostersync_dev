
import { Athlete, ExportFormat, SubscriptionTier } from "../types.ts";

export function generateExport(
  athletes: Athlete[],
  format: ExportFormat,
  teamName: string,
  language: string = 'EN',
  tier: SubscriptionTier = 'BASIC'
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
          jerseyNumber: a.jerseyNumber,
          position: a.position,
          seasonYear: a.seasonYear
        };
        if (tier !== 'BASIC') {
          row.phonetic = a.phoneticSimplified;
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
      const iconikMetadata = {
        "auto_set": true,
        "date_created": nowIso,
        "date_modified": nowIso,
        "description": `Imported via RosterSync`,
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
          "label": a.fullName,
          "value": a.fullName
        })),
        "read_only": false,
        "representative": true,
        "required": false,
        "sortable": true,
        "source_url": null,
        "use_as_facet": true
      };

      return {
        content: JSON.stringify(iconikMetadata, null, 2),
        filename: `${safeTeam}_iconik_${langSuffix}_${timestamp}.json`,
        mimeType: 'application/json'
      };

    case 'AFTER_EFFECTS_CSV':
      const aeHeaders = ["Name", "DisplayName", "Jersey", "Position", "Phonetic", "Language"];
      const aeRows = athletes.map(a => [
        a.fullName,
        a.displayNameSafe,
        a.jerseyNumber,
        a.position,
        a.phoneticSimplified,
        language
      ].join(","));
      return {
        content: [aeHeaders.join(","), ...aeRows].join("\n"),
        filename: `${safeTeam}_after_effects_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'ROSS_XP_CSV':
      const rossXPHeaders = ["ID", "NAME_CAPS", "JERSEY", "POS", "PHONETIC", "HEADSHOT"];
      const rossXPRows = athletes.map(a => [
        a.jerseyNumber || a.id.split('-')[1] || "0",
        a.displayNameSafe.toUpperCase(),
        a.jerseyNumber,
        a.position.toUpperCase(),
        a.phoneticSimplified || "",
        `C:\\Rosters\\Heads\\${a.jerseyNumber}.tga`
      ].map(val => `"${val}"`).join(","));

      return {
        content: [rossXPHeaders.join(","), ...rossXPRows].join("\n"),
        filename: `${safeTeam}_ross_xpression_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'VIZRT_DATACENTER_CSV':
      const vizHeaders = ["KEY", "ID", "NAME", "POS", "PHONETIC", "BIO_JSON"];
      const vizRows = athletes.map(a => {
        const bioData = {
          status: a.nilStatus,
          season: a.seasonYear,
          stats: a.bioStats || "",
          handle: a.socialHandle || ""
        };
        return [
          a.jerseyNumber,
          a.jerseyNumber,
          a.displayNameSafe.toUpperCase(),
          a.position.toUpperCase(),
          a.phoneticSimplified || "",
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
        vxml += `      <field name="ID">${a.jerseyNumber}</field>\n`;
        vxml += `      <field name="NAME_CAPS">${a.displayNameSafe.toUpperCase()}</field>\n`;
        vxml += `      <field name="POSITION">${a.position.toUpperCase()}</field>\n`;
        vxml += `      <field name="PRONUNCIATION">${a.phoneticSimplified || ''}</field>\n`;
        vxml += `      <field name="STAT_LINE">${a.bioStats || ''}</field>\n`;
        vxml += `      <field name="HEADSHOT_URL">C:\\RosterSync\\Heads\\${a.jerseyNumber}.tga</field>\n`;
        vxml += `    </element>\n`;
      });
      vxml += `  </playlist>\n</tickerfeed>`;
      return {
        content: vxml,
        filename: `${safeTeam}_vizrt_ticker_${langSuffix}_${timestamp}.xml`,
        mimeType: 'application/xml'
      };

    case 'CHYRON_CSV':
      const chyronHeaders = ["Index", "PlayerName", "PlayerNumber", "PositionAbbr", "Bio_Stats", "SocialHandle"];
      const chyronRows = athletes.map((a, idx) => [
        idx + 1,
        a.fullName,
        a.jerseyNumber,
        a.position.toUpperCase(),
        a.bioStats || "Production ready bio summary pending.",
        a.socialHandle || `@${a.fullName.toLowerCase().replace(/\s+/g, '')}`
      ].map(val => `"${val}"`).join(","));

      return {
        content: [chyronHeaders.join(","), ...chyronRows].join("\n"),
        filename: `${safeTeam}_chyron_prime_${langSuffix}_${timestamp}.csv`,
        mimeType: 'text/csv'
      };

    case 'NEWBLUE_CSV':
      const newBlueHeaders = ["Title", "Subtitle", "Description", "Image_URL"];
      const newBlueRows = athletes.map(a => [
        a.fullName,
        `${a.position} | #${a.jerseyNumber}`,
        a.bioStats || `${a.fullName} is an ${a.nilStatus} athlete for ${teamName}.`,
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
      const tagboardHeaders = ["Name", "Jersey", "Position", "Team Name", "Headshot URL", "Team Logo URL"];

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
        a.jerseyNumber,
        a.position,
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
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ROSTER TEAM="${teamName.toUpperCase()}" LANGUAGE="${language.toUpperCase()}">\n`;
      athletes.forEach(a => {
        xml += `  <ATHLETE ID="${a.id}">\n`;
        xml += `    <NAME>${a.displayNameSafe}</NAME>\n`;
        xml += `    <JERSEY>${a.jerseyNumber}</JERSEY>\n`;
        xml += `    <POSITION>${a.position.toUpperCase()}</POSITION>\n`;
        xml += `    <STATUS>${a.nilStatus.toUpperCase()}</STATUS>\n`;
        xml += `  </ATHLETE>\n`;
      });
      xml += `</ROSTER>`;
      return {
        content: xml,
        filename: `${safeTeam}_ross_${langSuffix}_${timestamp}.xml`,
        mimeType: 'application/xml'
      };

    case 'VIZRT_JSON':
      const vizrtData = {
        team: teamName,
        players: athletes.map(a => {
          const safeImgName = a.displayNameSafe.toLowerCase().replace(/\s+/g, '_');
          const number = parseInt(a.jerseyNumber);
          return {
            id: a.id,
            name: a.fullName,
            number: isNaN(number) ? a.jerseyNumber : number,
            pos: a.position,
            img: `${safeImgName}_cutout.png`
          };
        })
      };
      return {
        content: JSON.stringify(vizrtData, null, 2),
        filename: `${safeTeam}_vizrt_${langSuffix}_${timestamp}.json`,
        mimeType: 'application/json'
      };

    case 'ODF_XML':
      // Simplified Olympic Data Feed (ODF) compatible XML
      let odf = `<?xml version="1.0" encoding="UTF-8"?>\n<ODF version="1.0">\n  <Competition Code="OG${timestamp.split('-')[0]}">\n`;
      const groupedByEvent = athletes.reduce((acc: any, a) => {
        const key = a.event || "General";
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
      }, {});

      Object.entries(groupedByEvent).forEach(([eventName, group]: [string, any]) => {
        const safeEvent = eventName.replace(/\s+/g, '_').toUpperCase();
        odf += `    <Discipline Code="${safeEvent.substring(0, 4)}">\n`;
        odf += `      <Event Name="${eventName}">\n`;
        odf += `        <Entries>\n`;
        group.forEach((a: Athlete) => {
          odf += `          <Athlete Bib="${a.jerseyNumber}" Name="${a.displayNameSafe}" NOC="${a.countryCode || ''}" Position="${a.position.toUpperCase()}">\n`;
          odf += `            <Metadata Phonetic="${a.phoneticSimplified || ''}" Bio="${a.bioStats || ''}" />\n`;
          odf += `          </Athlete>\n`;
        });
        odf += `        </Entries>\n`;
        odf += `      </Event>\n`;
        odf += `    </Discipline>\n`;
      });
      odf += `  </Competition>\n</ODF>`;
      return {
        content: odf,
        filename: `${safeTeam}_odf_${langSuffix}_${timestamp}.xml`,
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
