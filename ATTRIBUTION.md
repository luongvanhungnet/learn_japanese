# Data attribution

The N3 Hán Việt importer uses Unicode Unihan `kVietnamese` data and falls back to the [kanji-data-hanviet](https://github.com/NVL4826/kanji-data-hanviet) project for characters without a Unihan reading. The latter project is distributed under the MIT License (copyright 2019 David Gouveia). Its license is available at the linked repository.

The N3 workbook and N2 PDF were supplied by the user and are used as vocabulary sources for this local application.

The English meanings use the English component of [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project), copyright James William BREEN and the Electronic Dictionary Research and Development Group. These glosses have been shortened, selected for the study lists, and supplemented with editorial overrides. The JMdict-derived English meanings are distributed under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See [EDRDG's licence statement](https://www.edrdg.org/edrdg/licence.html) and the bundled [licence text](public/JMdict-LICENSE.txt).

To refresh the English meanings, download and decompress the current [JMdict English XML](https://www.edrdg.org/pub/Nihongo/JMdict_e.gz), then run `python scripts/import_english_meanings.py path/to/JMdict_e.xml`. This step must also be run after rebuilding either collection from the original Vietnamese sources. Reviewed translations and disambiguation are kept in `scripts/english_meanings_overrides.json`.
