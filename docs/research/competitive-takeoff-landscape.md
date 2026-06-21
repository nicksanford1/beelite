# Research: Competitive landscape — AI/automated construction takeoff (flooring focus)

_Deep-research report · ? agents · saved for the project. Vendor claims flagged where unverified._

## Bottom line

For a small commercial flooring subcontractor, the competitive landscape splits into three real categories. (1) General AEC takeoff tools with genuine AI auto-detection — Togal.AI ($299/user/mo) and Kreo (AI gated to its $175/user/mo Pro tier) market true auto-detect/auto-measure of rooms, walls, doors, and windows, but in practice both are human-in-the-loop: the user must specify the target element/area first, and real Capterra reviews report messy output, duplicate line items, poor results on scanned/non-vector plans, and at least one outright failure. (2) Flooring-specific estimating tools (Measure Square / MeasureSquare, QFloors-via-MeasureSquare, FloorRight/RFMS Measure/Pacific Solutions) are largely manual, device-assisted (Bluetooth laser) workflows whose core automation is waste/cut/seam optimization on a user-built layout; MeasureSquare's separate "AI Takeoff" add-on does claim deep-learning/CV room/door/window detection but its own KB tells users to verify accuracy and expect manual adjustment. (3) Floor-plan digitization (CubiCasa) is the most genuinely automated — one mobile scan auto-generates a plan via a published CNN — and notably ships embeddable APIs/SDKs (white-label) that make a buy/integrate path realistic, though it outputs floor plans/GLA, not flooring takeoff quantities. The honest accuracy ceiling cited in the wild is ~2–4% vs manual, and only on standard residential architectural/structural elements — not commercial or MEP work. Strategically, "fully autonomous takeoff" is marketing optimism across the board; the defensible opening for a small flooring sub is a flooring-specific niche plus an integrated lead-to-bid workflow (leveraging the existing permit/lead pipeline and finish-schedule-reading app), optionally buying/integrating CubiCasa-style digitization rather than rebuilding takeoff from scratch — because head-on "general AI takeoff" competition against funded incumbents (Togal, Kreo) on raw detection is where a new entrant loses.

## Findings (with confidence + sources)

### [high] Togal.AI and Kreo market genuine AI auto-detection/auto-measurement of rooms, walls, doors, windows, and custom areas — positioning beyond manual click-to-measure digitizing.
Togal markets 'Unlimited automated takeoffs' as the lead Growth-plan feature and frames the product as 'watch AI automatically handle all the tedious clicking and counting.' Kreo's homepage states it is an 'AI-powered tool that automatically detects and measures rooms, walls, doors, windows, and custom areas on your drawings,' and its help center describes Auto Measure as automatic detection 'WITHOUT manual click-to-measure steps.' Both are vendor-marketing claims (scoped as such), corroborated by third-party listings.

Sources: <https://www.togal.ai/pricing-licenses> · <https://www.kreo.net/>
_verification: 3-0 (both underlying claims)_

### [high] Despite auto-detect marketing, both Togal.AI and Kreo operate human-in-the-loop: the user must first specify the target area/element type (or click inside an area) before the AI generates measurements, and a human validates/adjusts the output.
Kreo: 'Just specify the type of area or element you're targeting, and the AI instantly processes your input to generate exact measurements'; help center confirms the user chooses element types then clicks Launch. One-Click Area: 'just click inside it and AI does the rest' (hybrid; user picks the area). Auto Measure 2.0 docs describe 'user-directed selectivity rather than full autonomy.' This pattern (specify-first, validate-after) is the actual workflow, not zero-input autonomous detection. The same human-in-the-loop reality applies to MeasureSquare's AI Takeoff (its KB warns to verify accuracy and make manual adjustments).

Sources: <https://www.kreo.net/trades/flooring-estimating-software> · <https://www.kreo.net/> · <https://help-takeoff.kreo.net/en/articles/5481199-auto-measure> · <https://help-takeoff.kreo.net/en/articles/8718150-one-click-area>
_verification: 3-0 (Kreo specify-first and click-inside claims)_

### [high] Kreo 2D Takeoff is a hybrid manual+AI tool (shape recognition, auto-count, bucket-fill) that is NOT fully automated room/area detection; it works best on vector drawings and struggles with scanned/poor-quality plans.
Capterra reviewers confirm hybrid workflow ('shape recognition algorithms speed my process by identifying areas'; 'bucket-fill...relieves me from a bunch of fine-point clicking'). Reviewer Vince L.: 'Kreo works best with vector drawings...difficult with scans of registered condominium plans.' Bucket-fill is a real vendor-named feature. Kreo's own blog concludes 'The workflow appears hybrid, not fully automated.'

Sources: <https://www.capterra.com/p/231342/Kreo-2D-Takeoff/reviews/> · <https://www.kreo.net/news-2d-takeoff/bucket-fill-new-ai-takeoff-tool>
_verification: 3-0_

### [high] Real users report Kreo's AI/auto-measure features are unreliable on complex or non-standard drawings — messy output, duplicate line items, and at least one 1-star review reporting it failed to produce a day's worth of work — even though overall ratings remain ~4.4/5.
Verified verbatim Capterra reviews: 'AI function is very hit and miss on particular drawings'; 'auto measure can be a little messy and i spend as much time organizing'; 'Each time you start and stop, a new condition is created' (duplicate items); and a 1-star: 'very bad and spent a day and did not produce a day's worth of measurements.' Reviews are 2023-2024, predating some of Auto Measure 2.0, so some issues may be partly addressed. G2 cross-check was blocked (403).

Sources: <https://www.capterra.com/p/231342/Kreo-2D-Takeoff/reviews/>
_verification: 3-0_

### [high] Togal.AI is priced for individual/small teams at $299/user/mo (billed yearly, ~$3,588/yr) with a custom Business tier for teams of 4+ users adding onboarding, dedicated support, classification-library template, quantity discounts, security compliance, and SSO.
Growth plan listed verbatim as '$299/mo per user, billed yearly'; Business plan 'Custom for teams with 4+ users' adding the six enumerated features over Growth. Corroborated by multiple 2026 third-party listings (G2, Capterra, GetApp, Foreman AI). 'Billed yearly' implies an annual commitment, not month-to-month.

Sources: <https://www.togal.ai/pricing-licenses>
_verification: 3-0 (all three Togal pricing claims)_

### [high] Kreo uses per-user SaaS pricing at $35 (Lite), $70 (Plus), and $175 (Pro, 'Most Popular') per user/month billed annually, plus custom Enterprise — but the AI takeoff tools (Auto Measure, One-Click Area, Auto Count) are gated to the $175 Pro tier and excluded from the $35 and $70 tiers.
Kreo pricing page (live 2026): Lite $35, Plus $70, Pro $175 per user/mo billed annually, Enterprise custom. Lite/Plus explicitly list 'Auto Measure ❌, One-Click Area ❌, Auto Count ❌'; Pro includes the full AI trio plus Caddie AI and Smart Labels. Caveat: 'Find Similar with AI' (named in one claim) does not appear on the current pricing page (misattributed); prices are per-user billed annually, not flat monthly.

Sources: <https://www.kreo.net/> · <https://www.kreo.net/pricing> · <https://www.kreo.net/trades/flooring-estimating-software>
_verification: 3-0 / 2-1 (AI-gating claim was 2-1 due to the 'Find Similar' misattribution)_

### [high] MeasureSquare's separate 'AI Takeoff' product CLAIMS to use AI deep learning and computer vision with pre-trained floor-plan datasets to auto-detect room boundaries, doors, and windows and produce object detection/counts for residential and commercial estimating.
Vendor page: 'AI Deep Learning and Computer Vision algorithms to detect room areas, doors and windows' and 'Automate the takeoff by detecting the room boundary, door and window locations with pre-trained floor plan data sets.' Lists 'Automatic object detection and counts' for residential and commercial. Corroborated by SelectHub, Toolify, Capterra. This is the most technically specific 'AI' claim among flooring-specific vendors and is genuine auto-detection in design.

Sources: <https://measuresquare.com/tools/ai-takeoff/> · <https://measuresquare.com/measure-square-ai-takeoff/>
_verification: 3-0 (four MeasureSquare AI-Takeoff claims)_

### [high] MeasureSquare's AI Takeoff is in practice semi-automated/human-in-the-loop: the vendor's own KB tells users to verify accuracy and make manual adjustments, and the site promises 'coming enhancements to improve accuracy and reduce errors of initial auto-takeoff.'
Official Zoho KB (Aug 2024): the system 'automatically scans a floor plan and attempts to detect walls, rooms, room names, and doors,' but 'When using AI features, be sure to check for accuracy. Manual adjustments may be necessary.' Vendor site admits planned accuracy/error improvements and recommends manually verifying critical dimensions. Reviews note 'occasional discrepancies in wall detection or doorway recognition.' Marketing 'full automation' framing should be flagged as optimism on real accuracy.

Sources: <https://measuresquare.com/tools/ai-takeoff/> · <https://measuresquare.com/measure-square-ai-takeoff/>
_verification: 3-0_

### [high] MeasureSquare 8 is sold by annual per-user subscription in three tiers — Retail $540/yr ($54/mo), Multi-family $1,640/yr ($164/mo), and Commercial (Most Popular) $1,970/yr ($197/mo) — i.e., flooring-specific tooling is materially cheaper than general AI takeoff (Togal $3,588/yr).
Primary pricing page and cloud purchase pages confirm $540/$1,640/$1,970 annual and $54/$164/$197 monthly, annual ≈ monthly × 10 (2 months free). A search snippet showing '$870/yr Multi-family / $179/mo Commercial' did not appear on any fetched vendor page (search-summarizer artifact).

Sources: <https://measuresquare.com/pricing/measuresquare-8/> · <https://cloud.measuresquare.com/>
_verification: 3-0_

### [high] Core flooring-specific estimating products (QFloors via Measure Square; FloorRight) center on MANUAL, device-assisted measurement (Bluetooth laser) rather than auto-detection from a plan; their disclosed automation is waste/cut optimization, seam layout, and pattern matching on a user-built layout, with no AI/CV/vector-parsing disclosed on the core estimation page.
QFloors page: 'Zip through measurements with your bluetooth laser measure device,' then 'Instantly estimate product quantities, directions, and seam layouts' (estimation after measurement). Page discloses no AI/CV/vector parsing; automation language is 'automatically optimizes waste and cuts' and 'matches flooring patterns across rooms.' Plans can be imported only as background reference. (One claim's 'limited to' is slightly imprecise — CRM auto-populate/attach features also exist — but those are not takeoff tech.)

Sources: <https://www.qfloors.com/qfloors-products/floor-covering-estimation.html>
_verification: 3-0 / 2-1 (the 'no AI disclosed' claim was 2-1 on 'limited to' wording)_

### [high] QFloors has no proprietary takeoff/digitization engine — it resells and integrates Measure Square (since an Oct 2017 agreement) as its flooring takeoff/estimation product, auto-populating QFloors sales orders and attaching seam diagrams/cut sheets to Document Manager.
QFloors page: 'Measure Square estimators are sold and supported by QFloors through a partnership with Measure Square, Corp.' Partnership announcement grants QFloors rights to market/sell/support MeasureSquare; MeasureSquare partners page confirms integration via 'MeasureSquare Cloud API'; Wood Floor Business (trade press) corroborates. Demonstrates that even an established flooring-software vendor chose to BUY/integrate rather than build takeoff.

Sources: <https://www.qfloors.com/qfloors-products/floor-covering-estimation.html> · <https://www.qfloors.com/news/measuresquare-floor-estimation-software-partnership.html> · <https://measuresquare.com/partners/>
_verification: 3-0_

### [high] FloorRight is being deprecated: Pacific Solutions (acquired by Cyncly, which also owns RFMS) has stopped new FloorRight development and shifted all new development to RFMS Measure as its premier estimating product; FloorRight stays supported only until an as-yet-unannounced end-of-life date.
Vendor: 'We are shifting all new development to the RFMS Measure product. Measure will become our premier estimating software,' and 'FloorRight will remain supported. We will announce an end-of-life date well in advance.' Cyncly acquired Pacific Solutions (July 2023) after acquiring RFMS — explaining consolidation. Signals ongoing consolidation/roll-up in the flooring-estimating segment (a competitive and acquisition-risk consideration).

Sources: <https://www.pacific-solutions.com/floorright-measure.html> · <https://www.cyncly.com/resources/news/cyncly-acquires-pacific-solutions>
_verification: 3-0_

### [high] CubiCasa is the most genuinely automated entrant: one mobile scan auto-detects walls, doors, windows, and openings (no clicking each wall), backed by a publicly documented, peer-reviewed CNN (CubiCasa5K dataset, arXiv 1904.01920) — but it outputs floor plans/GLA, not flooring takeoff quantities, and processing is batch (next-day/~6hr) with human QA, not instant on-device.
Testimonial on CubiCasa's site explicitly contrasts with manual workflows: 'While in most programs you have to scan each room, click at each wall, add doors, windows...I love that CubiCasa does all of that for you in one single scan.' Independent guides confirm walk-through scan -> upload -> auto-generated plan with no manual wall drawing. Underlying tech is a published multi-task CNN segmenting plans into rooms/walls/doors/windows. Caveat: it produces plans/GLA, not construction/flooring quantities directly.

Sources: <https://www.cubi.casa/developers/> · <https://arxiv.org/abs/1904.01920>
_verification: 3-0_

### [high] A buy/integrate path is viable: CubiCasa exposes embeddable APIs/SDKs (Integrate API, Conversion API, Exporter API, GoToScan, official iOS and Android Mobile SDKs) enabling a fully white-label scanning-to-floor-plan capability rather than building digitization from scratch.
CubiCasa: 'Embed CubiCasa's scanning technology into your application to create a fully white label solution.' Each component verified live: Integrate API (order workflow), Conversion API ('intended for advanced integration by enterprise level customers'), Exporter API (JPG/PNG/SVG/PDF), GoToScan, and official iOS/Android SDK repos. Supports a 'buy the digitization layer, build the flooring-specific quantity/bid logic on top' strategy.

Sources: <https://www.cubi.casa/developers/> · <https://integrate.docs.cubi.casa/> · <https://conversion.docs.cubi.casa/> · <https://github.com/CubiCasa/cubicasa-ios-sdk-example-project> · <https://github.com/CubiCasa/cubicasa-android-sdk-example-project>
_verification: 3-0_

### [low] The honest, real-world accuracy ceiling cited in the wild is ~2–4% vs manual results — but ONLY on standard residential architectural/structural elements (walls, doors, windows, slab/roof), NOT on commercial or MEP work, where the gap widens and trade estimators are still required.
Eano blog (Apr 2026): 'On standard residential work, experienced users consistently report AI takeoff accuracy within 2 to 4 percent of manual results on architectural and structural elements,' with the gap widening on 'complex commercial or industrial projects' and MEP 'still requires an experienced trade estimator.' Low confidence: the figure is unsourced vendor/SEO blog content (no third-party study), repeated near-verbatim across SEO blogs; treat as directional, not benchmarked — especially relevant since the target user does COMMERCIAL flooring, where even this optimistic figure does not apply.

Sources: <https://www.eano.com/blogs/ai-construction-takeoff-software-what-it-gets-right-and-where-it-still-falls-short>
_verification: 2-1_

### [medium] Strategic assessment for a small commercial flooring sub: 'fully autonomous takeoff' is marketing optimism everywhere (all leading tools are human-in-the-loop), so head-on competition on raw general AI detection favors funded incumbents (Togal, Kreo) — the defensible play is a flooring-specific niche + integrated lead-to-bid workflow, optionally buying/integrating CubiCasa-style digitization rather than rebuilding takeoff.
Synthesis of confirmed facts: (a) every leading 'AI takeoff' tool is human-in-the-loop with documented accuracy limits and user complaints, so 'autonomous takeoff' is not a defensible moat for a new entrant; (b) general takeoff is crowded and funded (Togal $299/user/mo, Kreo Pro $175/user/mo); (c) flooring incumbents themselves BUY/integrate (QFloors resells Measure Square) and consolidate (FloorRight->RFMS Measure), showing the build-from-scratch path is unattractive even to established vendors; (d) CubiCasa offers white-label SDKs/APIs making integration realistic; (e) commercial/MEP accuracy is weak even by optimistic blog claims — but commercial flooring specifically (seams, waste, transitions, finish schedules) is a niche the generalists do not optimize for. The genuine opportunity is integrating an existing permit/lead pipeline + finish-schedule-reading app + flooring-specific quantity/seam/waste logic into one lead-to-bid workflow, layering bought digitization rather than competing on generic detection. Medium confidence because it is an inference from verified facts, not a directly sourced market analysis.

Sources: <https://www.togal.ai/pricing-licenses> · <https://www.kreo.net/> · <https://www.capterra.com/p/231342/Kreo-2D-Takeoff/reviews/> · <https://www.cubi.casa/developers/> · <https://www.qfloors.com/qfloors-products/floor-covering-estimation.html> · <https://measuresquare.com/tools/ai-takeoff/>
_verification: synthesis_
