# Appearance guidance and affiliate recommendations

The analysis changes are server-side; the only client change is the existing product card URL binding. The app UI, layouts, camera, landmarks, navigation, numerical scoring formula, authentication, subscription checks, database schema and AI provider selection are unchanged.

## How the supplied material is used

The four user-supplied forum exports were inspected as reference material, not instructions or medical authority:

- The Ultimate Eye Area Guide: separate eye features, photo conditions and modifiable presentation versus structural questions.
- How to Measure Every Ratio: its pasted measurements are largely image attachments, not usable numerical definitions. No missing formulas, ideal ranges or new measurements were invented.
- Complete self-improvement guide: eye-area theory/practical sections plus general grooming, skin, sleep and sustainable fitness topics. Large repeated post quotes/comments were not injected into API requests.
- Beginner's Guide to Softmaxxing: routine simplicity, hair/grooming and consistent photo conditions, without its medical protocols or unsupported structural claims.

`appearanceKnowledge.js` contains a curated, paraphrased guide shared by core scan prompts, extended eye-metric prompts, authorized vision review, product recommendations and Adonis. Coaching selects relevant sections using the current question, recent turns and actual saved improvement text. It is prompt context, not model fine-tuning or a scientifically validated PSL system. Scans' cached-prompt version was advanced so old cached analysis does not silently bypass the new guidance. Existing scores/results are not rewritten.

The knowledge separates apparent tilt, eye opening, lid exposure, brows/lashes, under-eye shadows, puffiness and texture. Photo limitations and actual saved measurements remain explicit. No inferred orbital measurements, personality judgments or blanket "hunter/prey" rankings are introduced. Recommendations distinguish no-purchase habits, temporary cosmetic effects and concerns that products cannot resolve.

Claims not adopted include oral minoxidil/peptide doses, periocular microneedling, hormone/GLP-1 protocols, DIY eye pulling and squint training, universal black-dye/flat-brow rules, implied surgical candidacy from selfies and guaranteed score improvements. A low numerical eye/skin score does not establish a diagnosis or specific cosmetic condition. The guide does not claim that skincare replaces volume, changes canthal tendons or remodels bone.

## Evidence checked

The following primary professional/regulatory guidance was checked when curating the material (October 21, 2026). These sources do not validate PSL scores or endorse affiliate products:

- FDA, Eye Cosmetic Safety: https://www.fda.gov/cosmetics/cosmetic-products/eye-cosmetic-safety
- American Academy of Dermatology, Wrinkle remedies: https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/wrinkle-remedies
- FDA minoxidil product labelling: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=ccaecec5-5348-4b24-9190-5464c50f6d80
- RANZCO, position statement on cosmetic eyelash serums containing prostaglandin analogues (2021): https://ranzco.edu/wp-content/uploads/2021/03/RANZCO-Position-Statement-on-prostaglandin-analogues-in-eyelash-growth-serums.pdf
- FDA, Dermal Fillers: https://www.fda.gov/medical-devices/aesthetic-cosmetic-devices/dermal-fillers-soft-tissue-fillers

No forum bibliography was accepted as proof without verification. There is no runtime web retrieval, diagnosis, prescribing or product availability lookup.

## Product links

The existing app catalogue uses Amazon Canada and `ascendusapp05-20`. The server uses that same public identifier; `AMAZON_ASSOCIATE_TAG` can explicitly override the tag. No environment file or production setting was changed. Marketplace selection remains Amazon.ca, matching the existing links.

Adonis requests an internal structured reply `{message, products}`. The external HTTP contract remains `{message, conversationId, scanStatus, scanId, visualStatus}`: clients still render a text message. The server appends tagged Amazon search URLs and a short affiliate disclosure only when suitable commercial recommendations exist. Ordinary medical/structural questions are explicitly no-shopping, and unsafe product categories are filtered before generating links. Wrong model tags/opaque Amazon shortlinks are not accepted as affiliate destinations. No ASIN, price, stock or delivery promise is invented.

The existing products endpoint retains its original name/description/searchQuery fields and adds `amazonUrl`. Static responses are decorated too. The old eye-cream claim was limited to surface hydration, low eye scores no longer imply dark circles, and fallback maintenance products do not infer skin disease from pillar scores. Product recommendations reuse the existing distributed AI limiter.

The existing results product cards now use the returned amazonUrl, with a tagged Amazon.ca search fallback for older responses. Their layout, classes, animations and existing anchor styling are unchanged. Chat URLs are returned in the existing text body; this change does not add a new chat clickable-link renderer or redesign product cards. Existing static shop/affiliate catalogue components are untouched. Because of this URL-only client change, physical iPhone use still requires a build, iOS sync and fresh Xcode installation.

## Tests and limits

Automated checks cover exact-query encoding, fixed marketplace/tag, tag injection, wrong model links, malformed responses, prohibited drug/device links, no-shopping questions, shared eye knowledge in real coach HTTP requests, unchanged scan fields, user isolation, Pro access and the additive product field.

Live OpenAI scenario checks use isolated invented scan context, not private user scans. They exercise structural limits, a suitable eye-area moisturizer with a tagged link, missing angle measurements, drug claims and jaw-training claims. They do not establish clinical effectiveness, Amazon inventory/affiliate-account validity, physical-device behavior or scientific calibration of the app's subjective scores.
