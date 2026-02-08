
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('groups_list.json', 'utf-8'));

if (data.groups) {
    console.log(`Found ${data.groups.length} groups.`);
    const g = data.groups[0];
    console.log('Sample Group:', {
        id: g.id,
        name: g.name,
        shortName: g.shortName,
        teamsCount: g.teams?.length,
        childrenCount: g.children?.length
    });

    if (g.children) {
        console.log('Use Children:', g.children.map((c: any) => `${c.id}: ${c.name}`));
    }

    // Check Division I specifically (index 1 usually)
    const div1 = data.groups.find((grp: any) => grp.name === 'NCAA Division I');
    if (div1 && div1.children) {
        console.log('Division I Conferences:', div1.children.map((c: any) => `${c.id}: ${c.name}`));
    }


    // Print all group names
    console.log('Groups:', data.groups.map((g: any) => `${g.id}: ${g.name}`));
} else {
    console.log('No top-level groups found. Keys:', Object.keys(data));
}
