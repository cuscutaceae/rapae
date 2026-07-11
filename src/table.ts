import * as cheerio from "cheerio";
import { fetchDifficultyTable } from "./api.js";

type TableRow = {
    [key: string]: string | number | null;
};

async function analyzeTable(url: string) {
    const html = await fetchDifficultyTable(url);
    const $ = cheerio.load(html);
    let table = $("table[class*=wikitable]");
    const result: TableRow[] = [];
    const headers: string[] = [];
    table.find("thead tr").each((_, row) => {
        $(row)
            .find("th")
            .each((_, th) => {
                headers.push($(th).text().trim());
            });
    });
    if (headers.length === 0) {
        table
            .find("tr")
            .first()
            .find("th, td")
            .each((_, cell) => {
                // console.log($(cell));
                const v = $(cell);
                headers.push(
                    v.children().length === 0
                        ? v.text().trim()
                        : v.find("span").text().trim(),
                );
            });
    }
    if (headers.length === 0) {
        const firstRowCells = table.find("tr").first().find("td").length;
        for (let i = 0; i < firstRowCells; i++) {
            headers.push(`col_${i + 1}`);
        }
    }
    const rows = table.find("tr");
    rows.each((index, row) => {
        if (index === 0 && table.find("thead").length === 0) return;
        if (index === 0 && table.find("thead").length > 0) return;
        const cells = $(row).find("td");
        if (cells.length === 0) return;
        const rowData: TableRow = {};
        cells.each((i, cell) => {
            const key =
                headers[i]
                    ?.replace("曲目", "song_name")
                    ?.replace("PST", "past")
                    ?.replace("PRS", "present")
                    ?.replace("FTR", "future")
                    ?.replace("BYD", "beyond")
                    ?.replace("ETR", "eternal") || `col_${i + 1}`;
            const text = $(cell).text().trim();
            const tryNumber = Number(text);
            rowData[key] =
                text.length === 0 ? null : !isNaN(tryNumber) ? tryNumber : text;
        });
        if (Object.keys(rowData).length > 0) {
            result.push(rowData);
        }
    });
    return result;
}

export { analyzeTable };
export type { TableRow };
