/* ==========================================================================
   BALE TO BRICK — Frontend Application
   Single-Page Agritech Platform & Real-Time Reverse-Bidding Marketplace
   Pure vanilla JavaScript, hash routing, zero build step.
   ========================================================================== */
(() => {
  'use strict';

  /* ───────────── state, storage, i18n ───────────── */
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const S = {
    token: store.get('b2b_token'), user: null, meta: null, prefs: null, stats: null,
    unread: 0, lang: store.get('b2b_lang') || 'en',
    filters: { q: '', state: '', crop: '', sort: 'match' },
    jobFilters: { state: '', crop: '', sort: '' },
  };

  const HI = {
    'Bale to Brick': 'बेल टू ब्रिक',
    'Skip to content': 'मुख्य सामग्री पर जाएँ',
    'Home': 'होम',
    'Marketplace': 'मार्केटप्लेस',
    'Find Transport': 'परिवहन खोजें',
    'Dashboard': 'डैशबोर्ड',
    'How It Works': 'यह कैसे काम करता है',
    'About Us': 'हमारे बारे में',
    'Log in': 'लॉग इन',
    'Sign up': 'साइन अप',
    'Log out': 'लॉग आउट',
    'Get Started': 'शुरू करें',
    'Explore Marketplace': 'मार्केटप्लेस देखें',
    'Farmer': 'किसान', 'Buyer': 'खरीदार', 'Operator': 'ऑपरेटर',
    'Farmers': 'किसान', 'Buyers': 'खरीदार', 'Operators': 'ऑपरेटर',
    'Farmer Portal': 'किसान पोर्टल', 'Buyer Portal': 'खरीदार पोर्टल', 'Transport Portal': 'परिवहन पोर्टल',
    'Stubble in the field. Bricks at the kiln.': 'खेत में पराली। भट्ठे पर ईंटें।',
    'Turning Farm Waste Into Valuable Resources.': 'खेत के अवशेषों को मूल्यवान संपदा में बदलना।',
    'India’s AI-powered agritech marketplace connecting farmers with crop residue, brick kilns & bioenergy industries, and local tractor/baler operators via real-time reverse bidding.': 'लाइव रिवर्स-बिडिंग के ज़रिए फसल अवशेष वाले किसानों, ईंट भट्ठों व बायोमास उद्योगों और स्थानीय ट्रैक्टर/बेलर ऑपरेटरों को जोड़ने वाला भारत का एआई कृषि-प्लेटफ़ॉर्म।',
    'Farmers list land that needs clearing. Brick makers pick the land that suits them. Baling operators bid the price down to get it cleared on time.': 'किसान सफाई वाली ज़मीन दर्ज करते हैं। ईंट निर्माता अपने हिसाब की ज़मीन चुनते हैं। बेलिंग ऑपरेटर समय पर सफाई के लिए कीमत घटाकर बोली लगाते हैं।',
    'I am a farmer': 'मैं किसान हूँ', 'I am a buyer': 'मैं खरीदार हूँ', 'I am an operator': 'मैं ऑपरेटर हूँ',
    'Already registered?': 'पहले से पंजीकृत हैं?',
    'Field': 'खेत', 'Bale': 'गठ्ठा', 'Kiln': 'भट्ठा',
    'listed so far': 'अब तक दर्ज', 'acres listed': 'एकड़ दर्ज', 'tonnes of stubble kept out of the fire': 'टन पराली जलने से बची',
    'deals completed': 'सौदे पूरे', 'operators on the platform': 'ऑपरेटर प्लेटफ़ॉर्म पर',
    'Three ways in': 'तीन तरह से जुड़ें',
    'Three Ways to Participate': 'जुड़ने के तीन आसान तरीके',
    'List your land': 'अपनी ज़मीन दर्ज करें',
    'Turn Stubble Into Income': 'पराली को आमदनी में बदलें',
    'Sustainably Fuel Your Kiln': 'अपने भट्ठे को पर्यावरण-अनुकूल ईंधन दें',
    'Bid, Bale & Transport': 'बोली लगाएँ, गठ्ठे बनाएँ और ढुलाई करें',
    'Post the acres, the crop and the date the field must be clear. Nobody burns, nobody chases buyers.': 'एकड़, फसल और खेत खाली करने की तारीख डालें। जलाने की ज़रूरत नहीं, खरीदार ढूँढने की भी नहीं।',
    'Pick land that fits': 'अपने हिसाब की ज़मीन चुनें',
    'Set your region, crop and price. See the best matches first, then say how much you will pay and by when.': 'अपना क्षेत्र, फसल और कीमत तय करें। सबसे अच्छे मेल पहले देखें, फिर बताएँ कितना देंगे और कब तक।',
    'Bid to clear it': 'सफाई की बोली लगाएँ',
    'Browse open jobs near you and promise a price and a number of days. Each new bid has to beat your last one.': 'अपने पास के खुले काम देखें और कीमत व दिन बताएँ। हर नई बोली पिछली से बेहतर होनी चाहिए।',
    'How a job moves': 'काम कैसे आगे बढ़ता है',
    'A farmer lists the land with the date it must be clear.': 'किसान ज़मीन और खाली करने की तारीख दर्ज करता है।',
    'A buyer picks it and names a budget and a deadline.': 'खरीदार उसे चुनकर बजट और समय-सीमा बताता है।',
    'Operators bid down. Every revision must be lower, or the same price in fewer days.': 'ऑपरेटर कीमत घटाते हैं। हर बदलाव कम कीमत का हो, या उसी कीमत में कम दिनों का।',
    'The buyer compares price, days, equipment and rating, then seals the deal.': 'खरीदार कीमत, दिन, उपकरण और रेटिंग देखकर सौदा पक्का करता है।',
    'The operator bales and hauls. The farmer confirms the field is clear.': 'ऑपरेटर गठ्ठे बनाकर ले जाता है। किसान खेत साफ होने की पुष्टि करता है।',
    'An example job': 'एक उदाहरण',
    '20 acres of paddy straw in Karnal. Budget ₹90,000, needed within 8 days.': 'करनाल में 20 एकड़ धान की पराली। बजट ₹90,000, 8 दिन में चाहिए।',
    'Rajdhani Baling': 'राजधानी बेलिंग', 'Haryana Agri Machinery': 'हरियाणा एग्री मशीनरी', 'Kisan Baler Services': 'किसान बेलर सर्विसेज़',
    'days': 'दिन', 'day': 'दिन', 'days left': 'दिन बाकी', 'day left': 'दिन बाकी', 'today': 'आज', 'overdue': 'समय निकल गया',
    'The lowest price is not the only thing that counts. The buyer can choose a faster crew or a better-rated one.': 'सबसे कम कीमत ही सब कुछ नहीं। खरीदार तेज़ या बेहतर रेटिंग वाला दल भी चुन सकता है।',
    'Bale to Brick connects the three sides and keeps the agreement on record. Payment is settled directly between the buyer and the operator.': 'बेल टू ब्रिक तीनों पक्षों को जोड़ता है और समझौते का रिकॉर्ड रखता है। भुगतान खरीदार और ऑपरेटर के बीच सीधे होता है।',
    'Turning agricultural crop residue into clean industrial energy and building bricks while ending toxic farm fires forever.': 'कृषि अवशेषों को स्वच्छ औद्योगिक ऊर्जा और ईंटों में बदलते हुए विषैले खेत की आग को हमेशा के लिए समाप्त करना।',
    'Email': 'ईमेल', 'Password': 'पासवर्ड', 'Full name': 'पूरा नाम', 'Mobile number': 'मोबाइल नंबर',
    'State': 'राज्य', 'District': 'ज़िला', 'Village': 'गाँव', 'Company name': 'कंपनी का नाम', 'Business name': 'व्यवसाय का नाम',
    'Equipment you have': 'आपके पास उपकरण', 'e.g. 2 balers, 1 rake, 3 trucks': 'जैसे 2 बेलर, 1 रेक, 3 ट्रक',
    'Acres you can clear per day': 'प्रतिदिन कितने एकड़ साफ कर सकते हैं',
    'At least 8 characters': 'कम से कम 8 अक्षर',
    'Log in as a farmer': 'किसान के रूप में लॉग इन', 'Log in as a buyer': 'खरीदार के रूप में लॉग इन', 'Log in as an operator': 'ऑपरेटर के रूप में लॉग इन',
    'Create a farmer account': 'किसान खाता बनाएँ', 'Create a buyer account': 'खरीदार खाता बनाएँ', 'Create an operator account': 'ऑपरेटर खाता बनाएँ',
    'New here?': 'नए हैं?', 'Create an account': 'खाता बनाएँ', 'Have an account?': 'खाता है?',
    'Demo accounts share the password demo1234.': 'डेमो खातों का पासवर्ड demo1234 है।',
    'Fill in demo login': 'डेमो लॉगिन भरें',
    'Quick Demo Login': 'क्विक डेमो लॉगिन',
    'Your land': 'आपकी ज़मीन', 'Post land': 'ज़मीन दर्ज करें', 'Post your land': 'अपनी ज़मीन दर्ज करें',
    'Post New Stubble / Land': '+ नई पराली / ज़मीन दर्ज करें',
    'Total Stubble Listed': 'कुल दर्ज पराली',
    'Stubble Cleared': 'सफाई हुई पराली',
    'Active Offers': 'सक्रिय बोलियाँ',
    'Environmental Savings': 'पर्यावरणीय बचत',
    'Open for buyers': 'खरीदारों के लिए खुला', 'Operators bidding': 'ऑपरेटर बोली लगा रहे हैं', 'Deal sealed': 'सौदा पक्का', 'Cleared': 'साफ हुआ', 'Withdrawn': 'वापस लिया',
    'Bidding open': 'बोली खुली है', 'Sealed': 'पक्का', 'Work in progress': 'काम चल रहा है', 'Waiting for farmer to confirm': 'किसान की पुष्टि का इंतज़ार',
    'Completed': 'पूरा हुआ', 'Cancelled': 'रद्द',
    'Waiting for a buyer to pick it.': 'किसी खरीदार के चुनने का इंतज़ार।',
    'picked it.': 'ने इसे चुना।', 'bids': 'बोलियाँ', 'bid': 'बोली', 'lowest': 'सबसे कम',
    'See the job': 'काम देखें', 'Open the deal': 'सौदा खोलें', 'Withdraw land': 'ज़मीन वापस लें',
    'You have not posted any land yet.': 'आपने अभी कोई ज़मीन दर्ज नहीं की।',
    'Post the acres and the date the field must be clear. Buyers near you will see it right away.': 'एकड़ और खेत खाली करने की तारीख डालें। आपके पास के खरीदार इसे तुरंत देखेंगे।',
    'Crop residue': 'फसल अवशेष', 'Land area (acres)': 'ज़मीन (एकड़)', 'Clear the land by': 'ज़मीन कब तक साफ चाहिए',
    'Your asking price per acre (₹)': 'प्रति एकड़ आपकी माँग (₹)', 'Leave 0 if you are happy to give it away.': 'मुफ़्त देना हो तो 0 रखें।',
    'Estimated tonnes': 'अनुमानित टन', 'Exact location (shared only after a deal is sealed)': 'सही पता (सौदा पक्का होने के बाद ही दिखेगा)',
    'Notes for buyers and operators': 'खरीदारों और ऑपरेटरों के लिए टिप्पणी', 'Save listing': 'दर्ज करें',
    'Estimated residue': 'अनुमानित अवशेष', 'tonnes': 'टन', 'tonnes (estimate)': 'टन (अनुमान)',
    'Paddy (rice) straw': 'धान की पराली', 'Wheat straw': 'गेहूँ का भूसा', 'Sugarcane trash': 'गन्ने की पत्तियाँ', 'Cotton stalks': 'कपास की डंठलें',
    'Maize stalks': 'मक्का की डंठलें', 'Mustard stalks': 'सरसों की डंठलें', 'Other residue': 'अन्य अवशेष',
    'acres of': 'एकड़', 'Clear by': 'साफ करने की तारीख', 'Farmer asks': 'किसान की माँग', 'Free to take away': 'मुफ़्त ले जाएँ', 'per acre': 'प्रति एकड़',
    'Find land': 'ज़मीन खोजें', 'My jobs': 'मेरे काम', 'Deals': 'सौदे', 'Open jobs': 'खुले काम', 'My bids': 'मेरी बोलियाँ', 'My land': 'मेरी ज़मीन',
    'Your preferences': 'आपकी पसंद', 'Regions you buy from': 'जिन क्षेत्रों से खरीदते हैं', 'Crops you want': 'आपको कौन-सी फसल चाहिए',
    'Smallest plot (acres)': 'सबसे छोटा प्लॉट (एकड़)', 'Most you will pay the farmer per acre (₹)': 'किसान को प्रति एकड़ अधिकतम (₹)',
    'Save preferences': 'पसंद सहेजें', 'Preferences saved.': 'पसंद सहेज ली गई।',
    'Leave empty to use your own state.': 'खाली छोड़ें तो आपका राज्य लिया जाएगा।',
    'Search district or village': 'ज़िला या गाँव खोजें', 'All states': 'सभी राज्य', 'All crops': 'सभी फसलें',
    'Best match': 'सबसे अच्छा मेल', 'Soonest deadline': 'सबसे नज़दीकी तारीख', 'Largest area': 'सबसे बड़ा क्षेत्र', 'Lowest price': 'सबसे कम कीमत',
    'Sort by': 'क्रम', 'match': 'मेल', 'Over your price limit': 'आपकी कीमत सीमा से ऊपर',
    'In your region': 'आपके क्षेत्र में', 'Near your plant': 'आपके प्लांट के पास', 'Crop you want': 'मनचाही फसल', 'Big enough': 'पर्याप्त बड़ा', 'Within your price': 'आपकी कीमत में',
    'Pick this land': 'यह ज़मीन चुनें', 'No land matches these filters.': 'इन फ़िल्टर से कोई ज़मीन नहीं मिली।',
    'Try another state or crop, or lower the smallest plot size.': 'दूसरा राज्य या फसल आज़माएँ, या सबसे छोटा प्लॉट घटाएँ।',
    'Your budget for clearing it (₹)': 'सफाई के लिए आपका बजट (₹)', 'You need it cleared by': 'आपको कब तक साफ चाहिए',
    'The farmer needs the land clear by': 'किसान को ज़मीन साफ चाहिए',
    'Notes for operators': 'ऑपरेटरों के लिए टिप्पणी', 'Open for bids': 'बोली के लिए खोलें',
    'You have no jobs yet.': 'अभी आपका कोई काम नहीं।', 'Pick land on the Find land page to open it for operator bids.': 'ऑपरेटर बोली के लिए ज़मीन "ज़मीन खोजें" पेज से चुनें।',
    'Review bids': 'बोलियाँ देखें', 'Budget': 'बजट', 'Needed by': 'कब तक चाहिए', 'no bids yet': 'अभी कोई बोली नहीं',
    'Lowest bid': 'सबसे कम बोली', 'Back': 'वापस', 'The buyer': 'खरीदार',
    'Bids, lowest first': 'बोलियाँ, सबसे कम पहले', 'Fastest': 'सबसे तेज़', 'New operator': 'नया ऑपरेटर', 'jobs done': 'काम पूरे',
    'Fleet Equipment': 'उपकरण बेड़ा', 'Capacity': 'क्षमता',
    'Too slow for your deadline now': 'अब आपकी समय-सीमा के लिए धीमा', 'Accept this bid': 'यह बोली स्वीकार करें',
    'Withdraw this job': 'यह काम वापस लें', 'No bids yet. Operators in this state have been told about the job.': 'अभी कोई बोली नहीं। इस राज्य के ऑपरेटरों को सूचित कर दिया गया है।',
    'Land': 'ज़मीन', 'Location': 'स्थान',
    'Place your bid': 'अपनी बोली लगाएँ', 'Improve your bid': 'अपनी बोली सुधारें',
    'Your total price (₹)': 'आपकी कुल कीमत (₹)', 'Days you need': 'आपको कितने दिन चाहिए',
    'Note to the buyer': 'खरीदार के लिए टिप्पणी', 'Send bid': 'बोली भेजें', 'Send improved bid': 'सुधरी बोली भेजें', 'Withdraw bid': 'बोली वापस लें',
    'Your bid': 'आपकी बोली', 'Your rank': 'आपकी रैंक', 'of': 'में से',
    'The current lowest bid is': 'अभी सबसे कम बोली है', 'Competitors stay anonymous.': 'प्रतिस्पर्धी गुमनाम रहते हैं।',
    'A revised bid must be lower, or the same price in fewer days.': 'नई बोली कम कीमत की हो, या उसी कीमत में कम दिनों की।',
    'You won this job.': 'यह काम आपको मिला।', 'This job went to another operator.': 'यह काम किसी और ऑपरेटर को मिला।',
    'No open jobs match.': 'कोई खुला काम नहीं मिला।', 'Try another state, or check back soon. New jobs are posted daily.': 'दूसरा राज्य चुनें या कुछ देर बाद देखें।',
    'Closest deadline': 'सबसे नज़दीकी समय-सीमा', 'Biggest budget': 'सबसे बड़ा बजट', 'Newest': 'सबसे नया', 'In my state first': 'पहले मेरा राज्य',
    'Bid now': 'अभी बोली लगाएँ', 'Improve bid': 'बोली सुधारें', 'View': 'देखें', 'Your rating': 'आपकी रेटिंग', 'No ratings yet': 'अभी कोई रेटिंग नहीं',
    'You have not bid on any job yet.': 'आपने अभी किसी काम पर बोली नहीं लगाई।', 'Open jobs are on the Open jobs page.': 'खुले काम "खुले काम" पेज पर हैं।',
    'Won': 'जीती', 'Lost': 'हारी', 'Active': 'सक्रिय', 'Closed': 'बंद',
    'No deals yet.': 'अभी कोई सौदा नहीं।', 'Sealed deals show up here with contact details for all three sides.': 'पक्के सौदे यहाँ तीनों पक्षों के संपर्क के साथ दिखेंगे।',
    'Deal': 'सौदा', 'Price': 'कीमत', 'Due': 'अंतिम तारीख', 'Open': 'खोलें',
    'Progress': 'प्रगति', 'Deal sealed on': 'सौदा पक्का हुआ', 'Work started': 'काम शुरू हुआ', 'Work marked done': 'काम पूरा बताया गया', 'Farmer confirmed': 'किसान ने पुष्टि की',
    'Start work': 'काम शुरू करें', 'Mark work done': 'काम पूरा करें', 'Confirm the land is clear': 'पुष्टि करें कि ज़मीन साफ है', 'Cancel deal': 'सौदा रद्द करें',
    'People on this deal': 'इस सौदे से जुड़े लोग', 'You': 'आप', 'Call': 'फ़ोन करें', 'Exact location': 'सही पता',
    'Rate the operator': 'ऑपरेटर को रेटिंग दें', 'Stars': 'सितारे', 'Comment (optional)': 'टिप्पणी (वैकल्पिक)', 'Send rating': 'रेटिंग भेजें',
    'Ratings': 'रेटिंग', 'Thank you. Your rating is saved.': 'धन्यवाद। आपकी रेटिंग सहेज ली गई।',
    'Notifications': 'सूचनाएँ', 'Nothing new yet.': 'अभी कुछ नया नहीं।', 'Menu': 'मेनू',
    'Profile': 'प्रोफ़ाइल', 'Save changes': 'बदलाव सहेजें', 'Saved.': 'सहेजा गया।', 'Change password': 'पासवर्ड बदलें',
    'Current password': 'मौजूदा पासवर्ड', 'New password': 'नया पासवर्ड', 'Password changed.': 'पासवर्ड बदल गया।',
    'Not now': 'अभी नहीं', 'Yes, continue': 'हाँ, आगे बढ़ें', 'Close': 'बंद करें',
    'Withdraw this land from the market?': 'क्या यह ज़मीन बाज़ार से हटानी है?', 'Withdraw': 'वापस लें',
    'Accept this bid and seal the deal? The other operators will be told the job is taken.': 'यह बोली स्वीकार कर सौदा पक्का करें? बाकी ऑपरेटरों को बता दिया जाएगा।',
    'Seal the deal': 'सौदा पक्का करें',
    'Withdraw this job? All bids will be closed and the land goes back on the market.': 'यह काम वापस लें? सभी बोलियाँ बंद होंगी और ज़मीन फिर बाज़ार में जाएगी।',
    'Cancel this deal? The land goes back on the market.': 'यह सौदा रद्द करें? ज़मीन फिर बाज़ार में जाएगी।',
    'Mark the work as done? The farmer will be asked to confirm.': 'काम पूरा बताएँ? किसान से पुष्टि माँगी जाएगी।',
    'Confirm that the land is cleared?': 'क्या पुष्टि करते हैं कि ज़मीन साफ हो गई?',
    'Confirm': 'पुष्टि करें',
    'Something went wrong.': 'कुछ गड़बड़ हो गई।', 'Loading…': 'लोड हो रहा है…',
    'Land posted. Buyers can see it now.': 'ज़मीन दर्ज हो गई। खरीदार अब इसे देख सकते हैं।',
    'The job is open. Operators can bid now.': 'काम खुल गया। ऑपरेटर अब बोली लगा सकते हैं।',
    'Bid sent.': 'बोली भेजी गई।', 'Bid improved.': 'बोली सुधर गई।', 'Bid withdrawn.': 'बोली वापस ली गई।',
    'Deal sealed.': 'सौदा पक्का हो गया।', 'Done.': 'हो गया।',
    'Your session ended. Please log in again.': 'आपका सत्र समाप्त हो गया। फिर से लॉग इन करें।',
    'Page not found': 'पेज नहीं मिला', 'Go to your dashboard': 'अपने डैशबोर्ड पर जाएँ',
    'Hello': 'नमस्ते', 'Total listed': 'कुल दर्ज', 'Cleared so far': 'अब तक साफ',
    'Landing page': 'मुख्य पृष्ठ',
    'acres': 'एकड़',
    'job done': 'काम पूरा',
    // verification
    'Send my verification code to': 'मेरा सत्यापन कोड यहाँ भेजें',
    'We send a 6-digit code to check that it is really yours.': 'हम 6 अंकों का कोड भेजते हैं ताकि पता चले कि यह सच में आपका है।',
    'Demo mode: the code will be shown on screen.': 'डेमो मोड: कोड स्क्रीन पर दिखाया जाएगा।',
    'Verify your account': 'अपना खाता सत्यापित करें', 'Enter your code': 'अपना कोड डालें',
    'We sent a 6-digit code to': 'हमने 6 अंकों का कोड भेजा है', 'It expires in': 'यह समाप्त होगा', 'minutes': 'मिनट में',
    'Demo mode: no SMS or email service is set up yet, so the code is shown here.': 'डेमो मोड: अभी SMS या ईमेल सेवा नहीं जुड़ी, इसलिए कोड यहाँ दिख रहा है।',
    'Fill it in': 'भर दें', '6-digit code': '6 अंकों का कोड', 'Verify': 'सत्यापित करें',
    'Send a new code': 'नया कोड भेजें', 'New code sent.': 'नया कोड भेज दिया।',
    'Account created and verified.': 'खाता बन गया और सत्यापित हो गया।',
    'Log in with a one-time code instead': 'इसके बजाय एक बार के कोड से लॉग इन करें',
    'Log in with your password instead': 'इसके बजाय पासवर्ड से लॉग इन करें',
    'Mobile number or email': 'मोबाइल नंबर या ईमेल', 'Send code': 'कोड भेजें',
    'Works with a mobile number or email you have verified.': 'उस मोबाइल नंबर या ईमेल से चलता है जिसे आपने सत्यापित किया है।',
    'Verification': 'सत्यापन', 'Verified': 'सत्यापित', 'Not verified': 'सत्यापित नहीं', 'Verified mobile': 'सत्यापित मोबाइल',
    'Verified.': 'सत्यापित हो गया।',
    'People on your deals see a tick next to verified details.': 'आपके सौदों के लोगों को सत्यापित जानकारी के पास निशान दिखता है।',
    'Verify your mobile number or email so others know your account is real.': 'अपना मोबाइल नंबर या ईमेल सत्यापित करें ताकि दूसरों को भरोसा हो कि आपका खाता असली है।',
    'Verify now': 'अभी सत्यापित करें',
    'If you change your number, you will need to verify it again.': 'नंबर बदलने पर उसे फिर से सत्यापित करना होगा।',
    // maps
    'Map': 'नक्शा', 'Field location on the map': 'नक्शे पर खेत की जगह',
    'Only the buyer and operator on a sealed deal see the exact pin. Before that, others see your village only.': 'सही पिन सिर्फ़ पक्के सौदे के खरीदार और ऑपरेटर देखते हैं। उससे पहले बाकी लोग सिर्फ़ आपका गाँव देखते हैं।',
    'Use my current location': 'मेरी अभी की जगह लें', 'Finding you…': 'आपकी जगह ढूँढ रहे हैं…',
    'Find my village on the map': 'नक्शे पर मेरा गाँव ढूँढें',
    'Tap the map to drop the pin on your field. Drag the pin to adjust it.': 'खेत पर पिन लगाने के लिए नक्शे पर टैप करें। ठीक करने के लिए पिन खींचें।',
    'Or paste coordinates or a Google Maps link': 'या निर्देशांक या Google Maps लिंक चिपकाएँ',
    'In Google Maps, press and hold on your field, then copy the numbers that appear.': 'Google Maps में अपने खेत पर दबाकर रखें, फिर दिखने वाले अंक कॉपी करें।',
    'Pinned at': 'पिन लगाया', 'Remove pin': 'पिन हटाएँ', 'Your area': 'आपका क्षेत्र',
    'No pin yet. A pin helps the operator reach the right field.': 'अभी कोई पिन नहीं। पिन से ऑपरेटर सही खेत तक पहुँचता है।',
    'Could not read coordinates from that. Try numbers like 30.6514, 75.6011.': 'इससे निर्देशांक नहीं मिले। 30.6514, 75.6011 जैसे अंक डालें।',
    'That spot is outside India. Place the pin on your field.': 'यह जगह भारत के बाहर है। पिन अपने खेत पर लगाएँ।',
    'This browser cannot share your location.': 'यह ब्राउज़र आपकी जगह नहीं बता सकता।',
    'Location only works on a secure (https) page.': 'जगह सिर्फ़ सुरक्षित (https) पेज पर काम करती है।',
    'Location permission was denied. Allow it in your browser settings, or place the pin yourself.': 'जगह की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति दें, या खुद पिन लगाएँ।',
    'Could not get your location. Try again, or place the pin yourself.': 'आपकी जगह नहीं मिली। फिर कोशिश करें, या खुद पिन लगाएँ।',
    'Pinned your current location. Check it is on your field.': 'आपकी अभी की जगह पर पिन लगा। देख लें कि यह आपके खेत पर है।',
    'Could not find that place. Move the map to your field yourself.': 'वह जगह नहीं मिली। नक्शे को खुद अपने खेत तक ले जाएँ।',
    'Google Maps could not load. Check your internet connection.': 'Google Maps लोड नहीं हुआ। इंटरनेट कनेक्शन जाँचें।',
    'Google Maps rejected the API key. Check the key and its allowed websites.': 'Google Maps ने API कुंजी अस्वीकार की। कुंजी और अनुमत वेबसाइटें जाँचें।',
    'Show area on map': 'नक्शे पर क्षेत्र देखें', 'Hide map': 'नक्शा छिपाएँ',
    'Village area only. The exact field is shared once the deal is sealed.': 'सिर्फ़ गाँव का क्षेत्र। सही खेत सौदा पक्का होने पर दिखेगा।',
    'Open in Google Maps': 'Google Maps में खोलें', 'Get directions': 'रास्ता देखें', 'Field on the map': 'नक्शे पर खेत',
    // Google features
    'Describe your land in your own words': 'अपनी ज़मीन के बारे में अपनी भाषा में बताएँ',
    'Speak or type in Hindi, Marwari, Mewari, Punjabi or English. Gemini fills the form for you.': 'हिंदी, मारवाड़ी, मेवाड़ी, पंजाबी या अंग्रेज़ी में बोलें या लिखें। Gemini आपके लिए फ़ॉर्म भर देगा।',
    'e.g. Mere paas 15 bigha dhan ki parali hai, Sangrur ke Lehra gaon mein, 10 din mein khet khali chahiye': 'जैसे: मेरे पास 15 बीघा धान की पराली है, संगरूर के लहरा गाँव में, 10 दिन में खेत खाली चाहिए',
    'Speak': 'बोलें', 'Listening… tap to stop': 'सुन रहे हैं… रोकने के लिए टैप करें', 'Fill the form': 'फ़ॉर्म भरें',
    'Form filled. Check each field before saving.': 'फ़ॉर्म भर गया। सहेजने से पहले हर खाना जाँच लें।',
    'Scan your land record': 'अपना ज़मीन का रिकॉर्ड स्कैन करें',
    'Take a photo of your Jamabandi, Khatauni or Fard. Gemini reads the owner, Khasra number and area. Buyers see a "land record checked" mark. The photo itself is not stored.': 'अपनी जमाबंदी, खतौनी या फ़र्द की फ़ोटो लें। Gemini मालिक, खसरा नंबर और रकबा पढ़ लेता है। खरीदारों को "रिकॉर्ड जाँचा गया" निशान दिखता है। फ़ोटो सहेजी नहीं जाती।',
    'Choose photo': 'फ़ोटो चुनें', 'Reading the document…': 'दस्तावेज़ पढ़ रहे हैं…',
    'Owner': 'मालिक', 'Khasra': 'खसरा', 'Area': 'रकबा', 'Use this area': 'यही रकबा लें',
    'Name matches your account': 'नाम आपके खाते से मेल खाता है', 'Name does not match your account': 'नाम आपके खाते से मेल नहीं खाता',
    'Land record checked': 'ज़मीन का रिकॉर्ड जाँचा गया', 'Area matches': 'रकबा मेल खाता है',
    'See the impact': 'असर देखें', 'If this residue is baled instead of burned': 'अगर यह पराली जलाने के बजाय गठ्ठों में बँधे',
    'tonnes of residue': 'टन अवशेष', 'bricks it can fire': 'ईंटें पक सकती हैं', 'tonnes of coal replaced': 'टन कोयले की जगह',
    'tonnes of CO₂ not released': 'टन CO₂ हवा में नहीं गई', 'kg of PM2.5 smoke avoided': 'किलो PM2.5 धुआँ बचा',
    'Rough estimates from average values.': 'औसत मानों से मोटा अनुमान।',
    'Suggested budget': 'सुझाया गया बजट', 'Typical price for this job': 'इस काम की आम कीमत', 'Use': 'लें',
    'km from your plant': 'किमी आपके प्लांट से', 'Nearest to my plant': 'मेरे प्लांट के सबसे पास',
    'List': 'सूची', 'Map': 'नक्शा', 'Your kiln': 'आपका भट्ठा', 'plots': 'प्लॉट',
    'Satellite check': 'सैटेलाइट जाँच', 'Check from space': 'सैटेलाइट से जाँचें', 'Checking satellite images…': 'सैटेलाइट तस्वीरें देख रहे हैं…',
    'Satellite: harvested': 'सैटेलाइट: कटाई हो चुकी', 'Satellite: crop still standing': 'सैटेलाइट: फसल अभी खड़ी है', 'Satellite: partly green': 'सैटेलाइट: थोड़ी हरियाली',
    'No fire seen': 'कोई आग नहीं दिखी', 'Fire seen on': 'आग दिखी',
    'Zero-burn check': 'पराली न जलाने की जाँच', 'No fire was seen at this field from': 'इस खेत पर कोई आग नहीं दिखी',
    'to': 'से', 'Fire was seen near this field on': 'इस खेत के पास आग दिखी',
    'Route': 'रास्ता', 'Machine yard to field': 'मशीन यार्ड से खेत', 'Field to kiln': 'खेत से भट्ठा', 'Hauling cost, roughly': 'ढुलाई का मोटा खर्च',
    'Add your kiln or machine yard on your Profile to see road distances.': 'सड़क की दूरी देखने के लिए प्रोफ़ाइल में अपना भट्ठा या मशीन यार्ड जोड़ें।',
    'Proof photos': 'सबूत की फ़ोटो', 'Add a photo': 'फ़ोटो जोड़ें', 'Uploading and checking…': 'अपलोड और जाँच हो रही है…',
    'Looks like a cleared field or bales': 'साफ खेत या गठ्ठे जैसा दिखता है', 'Smoke or fire in the photo': 'फ़ोटो में धुआँ या आग', 'Not clear what this shows': 'साफ नहीं कि इसमें क्या है',
    'Photo added.': 'फ़ोटो जुड़ गई।',
    'Your kiln or plant location': 'आपके भट्ठे या प्लांट की जगह', 'Where your machines are kept': 'आपकी मशीनें कहाँ रहती हैं',
    'Used to show distance to land and the road route on deals.': 'ज़मीन की दूरी और सौदों पर सड़क का रास्ता दिखाने के लिए।',
    'Save location': 'जगह सहेजें', 'Location saved.': 'जगह सहेज ली गई।',
    'Continue with Google': 'Google से जारी रखें', 'or': 'या',
    'No account yet. Finish signing up.': 'अभी खाता नहीं है। साइन अप पूरा करें।',
    'Email verified with Google': 'ईमेल Google से सत्यापित', 'Live': 'लाइव',
    'Built with Google': 'Google के साथ बना', 'On': 'चालू', 'Fallback': 'विकल्प चालू', 'Off': 'बंद',
    'For Farmers': 'किसानों के लिए',
    'For Industry & Fleet': 'उद्योग व फ्लीट के लिए',
    'Google Agritech Stack': 'Google एग्रीटेक स्टैक',
    'Calculate Environmental Impact': 'पर्यावरणीय प्रभाव की गणना',
    'Select crop and land area to estimate residue value and emissions avoided': 'अवशेष और बचे हुए धुएँ का अनुमान लगाने के लिए फसल और ज़मीन चुनें',
    // v3: navbar, landing, assistant
    'Stubble to fuel, not fire': 'पराली ईंधन बने, आग नहीं', 'Menu': 'मेनू', 'Jobs': 'काम', 'Profile': 'प्रोफ़ाइल',
    'Proof it works': 'काम का सबूत', 'Deals closed on Bale to Brick': 'बेल टू ब्रिक पर पूरे हुए सौदे',
    'Real flows from the demo marketplace: who bid, what the buyer paid, how fast the field was cleared.': 'डेमो मार्केटप्लेस के असली उदाहरण: किसने बोली लगाई, खरीदार ने कितना दिया, खेत कितनी जल्दी साफ हुआ।',
    'Auctions running now': 'अभी चल रही नीलामियाँ', 'Buyer budget': 'खरीदार का बजट', 'Won at': 'जीती कीमत', 'Bids': 'बोलियाँ', 'Cleared in': 'सफाई में लगे',
    'tonnes kept out of the fire': 'टन जलने से बचा', 'farmer earned': 'किसान को मिले', 'Completed deals will show up here.': 'पूरे हुए सौदे यहाँ दिखेंगे।',
    'From a burning problem to a brick kiln’s fuel': 'जलती समस्या से भट्ठे के ईंधन तक', 'Photo': 'फ़ोटो',
    'Harvested field with loose straw. The farmer lists it instead of setting it on fire.': 'कटाई के बाद खुली पराली वाला खेत। किसान आग लगाने की जगह इसे दर्ज करता है।',
    'The winning operator rakes, bales and loads the straw within the promised days.': 'जीतने वाला ऑपरेटर तय दिनों में पराली इकट्ठा करके गठ्ठे बनाता और लादता है।',
    'Bales reach the brick kiln or biomass plant and replace coal in the firing.': 'गठ्ठे ईंट भट्ठे या बायोमास प्लांट पहुँचते हैं और कोयले की जगह जलते हैं।',
    'Demo accounts share the password demo1234. Tap one to log in.': 'डेमो खातों का पासवर्ड demo1234 है। लॉग इन के लिए किसी एक पर टैप करें।',
    'Demo accounts: tap one to fill the mobile number.': 'डेमो खाते: मोबाइल नंबर भरने के लिए टैप करें।',
    'Ask Bale to Brick': 'बेल टू ब्रिक से पूछें', 'Ask AI': 'AI से पूछें', 'Voice assistant': 'वॉइस असिस्टेंट',
    'Hi! Ask me about your auctions, bids, orders or payments. Tap the mic and speak in Hindi or English.': 'नमस्ते! अपनी नीलामी, बोली, ऑर्डर या भुगतान के बारे में पूछिए। माइक दबाकर हिन्दी या अंग्रेज़ी में बोलिए।',
    'Hi! I can explain how Bale to Brick works. Tap the mic and speak in Hindi or English.': 'नमस्ते! मैं बता सकता हूँ कि बेल टू ब्रिक कैसे काम करता है। माइक दबाकर हिन्दी या अंग्रेज़ी में बोलिए।',
    'Mute spoken replies': 'बोलकर जवाब बंद करें', 'Speak replies aloud': 'जवाब बोलकर सुनाएँ', 'Open page': 'पेज खोलें',
    'Voice input needs Chrome or Edge. You can type instead.': 'बोलकर पूछने के लिए Chrome या Edge चाहिए। आप लिखकर भी पूछ सकते हैं।',
    'Stop listening': 'सुनना बंद करें', 'Speak': 'बोलें', 'Listening…': 'सुन रहा हूँ…', 'Ask by voice or type here': 'बोलकर या लिखकर पूछें',
    'Your question': 'आपका सवाल', 'Send': 'भेजें',
    'Microphone permission was denied. Allow it in the address bar, or type your question.': 'माइक की अनुमति नहीं मिली। एड्रेस बार से अनुमति दें, या सवाल लिखें।',
    // payments, tracking, auctions
    'Track': 'ट्रैक', 'Payments': 'भुगतान', 'Auctions': 'नीलामी', 'Track order': 'ऑर्डर ट्रैक करें', 'Track orders': 'ऑर्डर ट्रैक करें',
    'Reverse auctions': 'रिवर्स नीलामी', 'Start a new auction': 'नई नीलामी शुरू करें', 'Open auction room': 'नीलामी कक्ष खोलें',
    'Operators bid the price down. Accept the bid that suits you best: lowest price, fastest crew or best rating.': 'ऑपरेटर कीमत घटाकर बोली लगाते हैं। जो बोली आपको सबसे ठीक लगे उसे चुनें: सबसे कम कीमत, सबसे तेज़ दल या सबसे अच्छी रेटिंग।',
    'Live auctions': 'लाइव नीलामियाँ', 'Bids in play': 'चल रही बोलियाँ', 'Budget in play': 'लगा हुआ बजट', 'Saved against budget': 'बजट से बचत',
    'Closed': 'बंद', 'Top bids': 'शीर्ष बोलियाँ', 'Accept': 'स्वीकारें', 'Too slow': 'बहुत धीमा', 'Won': 'जीता', 'Rank': 'स्थान',
    'Deal price': 'सौदे की कीमत', 'Saved': 'बचत', 'bid move': 'बोली बदलाव', 'bid moves': 'बोली बदलाव', 'price down': 'कीमत घटी', 'from the first bid': 'पहली बोली से',
    'How the price fell': 'कीमत कैसे घटी', 'The price line appears with the first bid.': 'पहली बोली आते ही कीमत की रेखा दिखेगी।', 'Lowest bid fell to': 'सबसे कम बोली घटकर',
    'No live auctions right now.': 'अभी कोई लाइव नीलामी नहीं।', 'No closed auctions yet.': 'अभी कोई बंद नीलामी नहीं।',
    'Pick land on the marketplace and name your budget. Operators then bid to clear it.': 'मार्केटप्लेस पर ज़मीन चुनें और बजट बताएँ। फिर ऑपरेटर सफाई के लिए बोली लगाएँगे।',
    'Pay into escrow': 'एस्क्रो में भुगतान करें', 'Paid into escrow': 'एस्क्रो में जमा', 'Pay': 'भुगतान करें', 'Pay now': 'अभी भुगतान करें', 'Pay with': 'भुगतान का तरीका',
    'Net banking': 'नेट बैंकिंग', 'Card': 'कार्ड', 'Your bank': 'आपका बैंक', 'Last 4 digits of the card': 'कार्ड के आख़िरी 4 अंक',
    'Demo checkout: the full card number is never asked for.': 'डेमो चेकआउट: पूरा कार्ड नंबर कभी नहीं माँगा जाता।',
    'Demo gateway: the payment is recorded, no real money moves.': 'डेमो गेटवे: भुगतान दर्ज होता है, असली पैसा नहीं जाता।',
    'Demo gateway: payments are recorded, no real money moves.': 'डेमो गेटवे: भुगतान दर्ज होते हैं, असली पैसा नहीं जाता।',
    'The money is held safely until the farmer confirms the field is clear, then paid to the operator and the farmer. If the deal is cancelled before work starts, you get it back.': 'पैसा तब तक सुरक्षित रखा जाता है जब तक किसान खेत साफ होने की पुष्टि न करे, फिर ऑपरेटर और किसान को दिया जाता है। काम शुरू होने से पहले सौदा रद्द हो तो पैसा वापस मिलता है।',
    'Operator’s price for baling and hauling': 'बेलिंग और ढुलाई का ऑपरेटर मूल्य', 'Farmer’s price for the stubble': 'पराली के लिए किसान का मूल्य', 'Platform fee': 'प्लेटफ़ॉर्म शुल्क', 'Total': 'कुल',
    'Order': 'ऑर्डर', 'Reference': 'संदर्भ', 'Status': 'स्थिति', 'ref': 'संदर्भ', 'All payments': 'सभी भुगतान',
    'The operator has been told they can start work.': 'ऑपरेटर को बता दिया गया है कि वे काम शुरू कर सकते हैं।',
    'Pay into escrow so the operator can start. The money is released only after the farmer confirms the field is clear.': 'एस्क्रो में भुगतान करें ताकि ऑपरेटर काम शुरू कर सके। किसान की पुष्टि के बाद ही पैसा जारी होगा।',
    'Pay into escrow so the operator can start.': 'एस्क्रो में भुगतान करें ताकि ऑपरेटर काम शुरू कर सके।',
    'Waiting for the buyer to pay into escrow. Work starts after that.': 'खरीदार के एस्क्रो भुगतान का इंतज़ार। उसके बाद काम शुरू होगा।',
    'The buyer has paid. You can start work.': 'खरीदार ने भुगतान कर दिया है। आप काम शुरू कर सकते हैं।',
    'No payment was made on this deal.': 'इस सौदे पर कोई भुगतान नहीं हुआ।', 'No escrow payment on record for this deal.': 'इस सौदे का कोई एस्क्रो भुगतान दर्ज नहीं।', 'Not paid yet.': 'अभी भुगतान नहीं हुआ।',
    'Your share': 'आपका हिस्सा', 'Held in escrow': 'एस्क्रो में सुरक्षित', 'Released': 'जारी', 'Refunded': 'वापस किया', 'Paid': 'भुगतान हुआ',
    'Payout for baling work': 'बेलिंग काम का भुगतान', 'Payment for stubble': 'पराली का भुगतान', 'Escrow refund': 'एस्क्रो वापसी', 'Bank transfer': 'बैंक ट्रांसफ़र',
    'Held in escrow now': 'अभी एस्क्रो में', 'Due now': 'अभी देय', 'Received': 'प्राप्त', 'On its way (in escrow)': 'रास्ते में (एस्क्रो में)',
    'Waiting for your payment': 'आपके भुगतान का इंतज़ार', 'Transactions': 'लेन-देन', 'Date': 'तारीख', 'Type': 'प्रकार', 'Method': 'तरीका', 'Amount': 'राशि',
    'No payments yet.': 'अभी कोई भुगतान नहीं।', 'Once you seal a deal, pay into escrow from the deal page.': 'सौदा पक्का होने पर सौदे के पेज से एस्क्रो में भुगतान करें।',
    'Payments show up here once a buyer pays into escrow for your deal.': 'खरीदार के एस्क्रो भुगतान करने पर भुगतान यहाँ दिखेंगे।',
    'You pay into escrow once a deal is sealed. It is paid out when the farmer confirms the field is clear.': 'सौदा पक्का होने पर आप एस्क्रो में भुगतान करते हैं। किसान की पुष्टि पर यह आगे दिया जाता है।',
    'Money for your deals is held in escrow and paid to your bank when the farmer confirms the field is clear.': 'आपके सौदों का पैसा एस्क्रो में रहता है और किसान की पुष्टि पर आपके बैंक में भेजा जाता है।',
    'This deal is already paid.': 'इस सौदे का भुगतान हो चुका है।',
    'Every sealed deal, from payment to bales at the kiln.': 'हर पक्का सौदा, भुगतान से लेकर भट्ठे पर गठ्ठों तक।',
    'No orders to track yet.': 'अभी ट्रैक करने को कोई ऑर्डर नहीं।', 'Orders appear here once a deal is sealed.': 'सौदा पक्का होते ही ऑर्डर यहाँ दिखेंगे।',
    'Deal sealed': 'सौदा पक्का', 'Work started': 'काम शुरू', 'Baling in the field': 'खेत में बेलिंग', 'Bales on the way to the kiln': 'गठ्ठे भट्ठे की ओर',
    'Bales delivered at the kiln': 'गठ्ठे भट्ठे पर पहुँचे', 'Work marked done': 'काम पूरा बताया', 'Farmer confirmed': 'किसान ने पुष्टि की', 'Payment released': 'भुगतान जारी',
    'Crew on the way': 'दल रास्ते में', 'Loading bales': 'गठ्ठे लद रहे हैं', 'Update': 'अपडेट', 'Next': 'अगला',
    'Delivered and paid': 'पहुँचा और भुगतान हुआ', 'Cancelled, payment refunded': 'रद्द, भुगतान वापस',
    'Field progress': 'खेत की प्रगति', 'acres cleared': 'एकड़ साफ', 'tonnes of stubble': 'टन पराली', 'going to': 'जा रही है',
    'Post an update': 'अपडेट भेजें', 'What is happening now': 'अभी क्या हो रहा है', 'Acres cleared so far': 'अब तक साफ एकड़',
    'Note for the buyer and farmer': 'खरीदार और किसान के लिए टिप्पणी', 'e.g. 2 trolleys left for the kiln at 4 pm': 'जैसे 4 बजे 2 ट्रॉली भट्ठे के लिए निकलीं',
    'Send update': 'अपडेट भेजें', 'Updates from the field': 'खेत से अपडेट', 'Updates start once the crew is on the field.': 'दल के खेत पर पहुँचते ही अपडेट शुरू होंगे।', 'No updates yet.': 'अभी कोई अपडेट नहीं।',
    'Update sent to the buyer and the farmer.': 'अपडेट खरीदार और किसान को भेज दिया गया।',
    'Order details': 'ऑर्डर विवरण', 'Refunded on': 'वापसी की तारीख',
    'The operator says the work is done. Check the field and confirm.': 'ऑपरेटर के अनुसार काम पूरा है। खेत देखकर पुष्टि करें।',
    'Bale to Brick connects the three sides and keeps the agreement on record. The buyer pays into escrow; the operator and farmer are paid when the field is confirmed clear.': 'बेल टू ब्रिक तीनों पक्षों को जोड़ता है और समझौते का रिकॉर्ड रखता है। खरीदार एस्क्रो में भुगतान करता है; खेत साफ होने की पुष्टि पर ऑपरेटर और किसान को पैसा मिलता है।',
  };
  const t = (s) => (S.lang === 'hi' && HI[s]) || s;

  /* ───────────── icon system ───────────── */
  function icon(name, size = 18, cls = '') {
    const s = size;
    const icons = {
      logo: `<svg width="${s}" height="${s}" viewBox="0 0 32 32" class="${cls}"><circle cx="12" cy="19" r="8" fill="#E5A93C"/><circle cx="12" cy="19" r="4" fill="none" stroke="#0D261B" stroke-width="1.8"/><rect x="18" y="7.5" width="12" height="7" rx="1.5" fill="#A8412C"/><rect x="21" y="15.5" width="10" height="7" rx="1.5" fill="#A8412C"/></svg>`,
      wheat: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M2 22s5-3 8-10"/><path d="M10 12c-2-3-1-7-1-7s4-1 7 1c2 1.5 2 4.5 1 6l-7 0z"/><path d="M12 9c-1-2-.5-5-.5-5s3-.5 5 .5c1.5 1 1.5 3 .5 4.5l-5 0z"/></svg>`,
      tractor: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M3 11h7l2-5h5v5h3l2 4v4h-3"/><circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="2.5"/><path d="M9.5 17h6"/></svg>`,
      truck: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
      factory: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M2 20h20"/><path d="M20 20V8l-6 4V4l-6 4V2H4v18"/></svg>`,
      shield: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
      trophy: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>`,
      sparkles: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/><path d="M5 3v4"/><path d="M3 5h4"/></svg>`,
      satellite: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/></svg>`,
      mapPin: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
      coins: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M6 10h3"/></svg>`,
      clock: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      flame: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
      user: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      bell: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      check: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><polyline points="20 6 9 17 4 12"/></svg>`,
      leaf: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
      info: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
      search: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
      star: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="${cls}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      wallet: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`,
      arrowRight: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
    };
    return icons[name] || '';
  }

  function brandLogo(size = 44) {
    return `<img class="brand-logo" src="img/logo-192.png" width="${size}" height="${size}" alt="">
    <span class="brand-text">
      <span class="brand-title">Bale to Brick</span>
      <span class="brand-sub">${t('Stubble to fuel, not fire')}</span>
    </span>`;
  }

  /* ───────────── small helpers ───────────── */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const locale = () => (S.lang === 'hi' ? 'hi-IN' : 'en-IN');
  const fmtDate = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const fmtNum = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 });
  const daysText = (n) => (n < 0 ? t('overdue') : n === 0 ? t('today') : `${n} ${t(n === 1 ? 'day left' : 'days left')}`);
  const urgencyClass = (n) => (n <= 3 ? 'urgent' : n <= 7 ? 'soon' : '');
  const cropLabel = (k) => { const c = S.meta?.crops.find((x) => x.key === k); return t(c ? c.label : k); };
  const place = (o) => [o.village, o.district, o.state].filter(Boolean).map(esc).join(', ');
  const homeFor = (role) => ({ farmer: '#/farmer', buyer: '#/buyer/find', operator: '#/operator/jobs' }[role] || '#/');
  const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

  function stars(avg, n) {
    if (!n) return `<span class="muted">${t('New operator')}</span>`;
    return `<span class="rating" title="${avg} / 5"><span aria-hidden="true">★</span> ${avg} <span class="muted">(${n})</span></span>`;
  }

  const tick = (on, label) => (on
    ? `<span class="verified"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8"/><path d="M4.5 8.3l2.3 2.2 4.7-4.9"/></svg>${t(label)}</span>`
    : '');

  /* ───────────── Google Maps ───────────── */
  function mapEmbedUrl(q, { zoom = 14, satellite = false } = {}) {
    const key = S.meta.maps_key;
    if (key) return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&zoom=${zoom}&language=${S.lang}${satellite ? '&maptype=satellite' : ''}`;
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&hl=${S.lang}${satellite ? '&t=k' : ''}&output=embed`;
  }
  const mapFrame = (q, o = {}) => `<div class="map ${o.cls || ''}"><iframe src="${esc(mapEmbedUrl(q, o))}" title="${esc(o.title || t('Map'))}"
      loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  const areaQuery = (l) => [l.village, l.district, l.state, 'India'].filter(Boolean).join(', ');
  const pinQuery = (l) => (l.lat != null && l.lng != null ? `${l.lat},${l.lng}` : [l.address, l.village, l.district, l.state].filter(Boolean).join(', '));
  const gmapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const gmapsDirections = (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  const inIndia = (lat, lng) => lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;

  function parseCoords(text) {
    let s = String(text || '').trim();
    try { s = decodeURIComponent(s); } catch { /* keep raw */ }
    const pats = [
      /^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/,
      /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    ];
    for (const p of pats) { const m = s.match(p); if (m) return [Number(m[1]), Number(m[2])]; }
    return null;
  }

  let gmapsLoading = null;
  function loadGoogleMaps() {
    if (window.google?.maps?.importLibrary || window.google?.maps?.Map) return Promise.resolve();
    if (gmapsLoading) return gmapsLoading;
    gmapsLoading = new Promise((resolve, reject) => {
      window.__b2bMapsReady = () => resolve();
      window.gm_authFailure = () => toast(t('Google Maps rejected the API key. Check the key and its allowed websites.'), 'error');
      const sc = document.createElement('script');
      sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(S.meta.maps_key)}&callback=__b2bMapsReady&loading=async&language=${S.lang}&region=IN`;
      sc.async = true;
      sc.onerror = () => { gmapsLoading = null; sc.remove(); reject(new Error(t('Google Maps could not load. Check your internet connection.'))); };
      document.head.appendChild(sc);
    });
    return gmapsLoading;
  }
  const gmLib = (name) => (google.maps.importLibrary ? google.maps.importLibrary(name) : Promise.resolve(google.maps));

  let picker = null;

  async function initPicker() {
    picker = null;
    const box = $('#pin-map');
    if (!box) return;
    try {
      await loadGoogleMaps();
      const [{ Map }, { Marker }, { Geocoder }] = await Promise.all([gmLib('maps'), gmLib('marker'), gmLib('geocoding')]);
      if (!document.body.contains(box)) return;
      const map = new Map(box, {
        center: { lat: 23.5, lng: 78.9 }, zoom: 5, mapTypeId: 'hybrid', clickableIcons: false,
        streetViewControl: false, fullscreenControl: true, mapTypeControl: true, gestureHandling: 'cooperative',
      });
      const marker = new Marker({ map, draggable: true, visible: false });
      map.addListener('click', (e) => setPin(e.latLng.lat(), e.latLng.lng()));
      marker.addListener('dragend', (e) => setPin(e.latLng.lat(), e.latLng.lng()));
      picker = { map, marker, Geocoder };
      findArea(true);
    } catch (e) {
      box.outerHTML = `<p class="form-error">${esc(e.message)}</p>`;
    }
  }

  async function initPlaceSearch() {
    const slot = $('#place-search');
    if (!slot) return;
    try {
      await loadGoogleMaps();
      const { PlaceAutocompleteElement } = await gmLib('places');
      if (!PlaceAutocompleteElement || !document.body.contains(slot)) throw new Error('unavailable');
      const el = new PlaceAutocompleteElement({ includedRegionCodes: ['in'] });
      slot.innerHTML = `<span class="small"><b>${t('Find my village on the map')}</b></span>`;
      slot.appendChild(el);
      const pick = async (place) => {
        await place.fetchFields({ fields: ['displayName', 'location', 'viewport', 'addressComponents'] });
        const f = $('form[data-form="listing"]');
        if (!f) return;
        const comp = (type) => place.addressComponents?.find((c) => c.types.includes(type))?.longText;
        const village = comp('locality') || comp('sublocality_level_1') || comp('sublocality') || place.displayName;
        const district = comp('administrative_area_level_3') || comp('administrative_area_level_2');
        const state = comp('administrative_area_level_1');
        if (village) f.village.value = village;
        if (district) f.district.value = district.replace(/\s+district$/i, '');
        if (state && S.meta.states.includes(state)) f.state.value = state;
        if (picker) { if (place.viewport) picker.map.fitBounds(place.viewport); else if (place.location) { picker.map.setCenter(place.location); picker.map.setZoom(15); } }
        showPin();
      };
      el.addEventListener('gmp-select', (e) => pick(e.placePrediction.toPlace()));
      el.addEventListener('gmp-placeselect', (e) => pick(e.place));
    } catch { slot.remove(); }
  }

  async function findArea(quiet) {
    const f = $('form[data-form="listing"]');
    if (!picker || !f) return;
    const address = [f.village.value, f.district.value, f.state.value, 'India'].filter((x) => x && x.trim()).join(', ');
    try {
      const { results } = await new picker.Geocoder().geocode({ address, region: 'in' });
      if (!results?.length) throw new Error('none');
      if (f.lat.value) return;
      picker.map.fitBounds(results[0].geometry.viewport);
    } catch {
      if (!quiet) toast(t('Could not find that place. Move the map to your field yourself.'), 'error');
    }
  }

  function setPin(lat, lng, { pan = false, fromPaste = false } = {}) {
    const f = $('form[data-form="listing"]');
    if (!f) return false;
    if (!inIndia(lat, lng)) { toast(t('That spot is outside India. Place the pin on your field.'), 'error'); return false; }
    if (!fromPaste && f.pin_paste) f.pin_paste.value = '';
    f.lat.value = lat.toFixed(6);
    f.lng.value = lng.toFixed(6);
    if (picker) {
      picker.marker.setPosition({ lat, lng });
      picker.marker.setVisible(true);
      if (pan) { picker.map.panTo({ lat, lng }); if (picker.map.getZoom() < 16) picker.map.setZoom(17); }
    }
    showPin();
    return true;
  }

  function clearPin() {
    const f = $('form[data-form="listing"]');
    if (!f) return;
    f.lat.value = ''; f.lng.value = '';
    if (f.pin_paste) f.pin_paste.value = '';
    if (picker) picker.marker.setVisible(false);
    showPin();
  }

  function showPin() {
    const f = $('form[data-form="listing"]');
    const status = $('#pin-status');
    if (!f || !status) return;
    const has = !!f.lat.value;
    status.innerHTML = has
      ? `${t('Pinned at')} <b>${Number(f.lat.value).toFixed(5)}, ${Number(f.lng.value).toFixed(5)}</b>. <button type="button" class="link" data-action="clear-pin">${t('Remove pin')}</button>`
      : `<span class="muted">${t('No pin yet. A pin helps the operator reach the right field.')}</span>`;
    const prev = $('#pin-preview');
    if (!prev) return;
    const q = has ? `${f.lat.value},${f.lng.value}` : (f.district.value.trim() ? areaQuery({ village: f.village.value.trim(), district: f.district.value.trim(), state: f.state.value }) : '');
    if (!q) { prev.innerHTML = ''; prev.dataset.q = ''; return; }
    if (prev.dataset.q === q) return;
    prev.dataset.q = q;
    prev.innerHTML = `${has ? '' : `<p class="small muted">${t('Your area')}</p>`}${mapFrame(q, { zoom: has ? 17 : 12, satellite: has, title: t('Field on the map') })}`;
  }

  const jobsDone = (n) => `${n} ${t(n === 1 ? 'job done' : 'jobs done')}`;
  const LISTING_STATUS = { open: 'Open for buyers', claimed: 'Operators bidding', assigned: 'Deal sealed', completed: 'Cleared', cancelled: 'Withdrawn' };
  const REQ_STATUS = { open: 'Bidding open', awarded: 'Deal sealed', cancelled: 'Withdrawn' };
  const DEAL_STATUS = { sealed: 'Sealed', in_progress: 'Work in progress', awaiting_confirmation: 'Waiting for farmer to confirm', completed: 'Completed', cancelled: 'Cancelled' };
  const pill = (key, text) => `<span class="pill pill-${key}">${esc(t(text))}</span>`;

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && S.token && !path.startsWith('/auth/')) { endSession(); toast(t('Your session ended. Please log in again.'), 'error'); }
      const err = new Error(data.error || t('Something went wrong.'));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function toast(msg, kind = 'ok') {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = `${icon(kind === 'error' ? 'info' : 'check', 18)} <span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  const dlg = $('#modal');
  const openModal = (html) => { dlg.innerHTML = `<div class="modal-body">${html}</div>`; if (!dlg.open) dlg.showModal(); };
  const closeModal = () => { if (dlg.open) dlg.close(); resetRecaptcha(); };
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-action="close-modal"]')) closeModal(); });

  function confirmDialog(message, okLabel, danger = false) {
    return new Promise((resolve) => {
      openModal(`<h2 id="modal-title" class="modal-title">${esc(message)}</h2>
        <div class="actions"><button class="btn btn-ghost" data-confirm="0">${t('Not now')}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm="1">${esc(okLabel)}</button></div>`);
      const onClick = (e) => {
        const b = e.target.closest('[data-confirm]');
        if (!b) return;
        dlg.removeEventListener('click', onClick);
        dlg.removeEventListener('close', onClose);
        closeModal();
        resolve(b.dataset.confirm === '1');
      };
      const onClose = () => { dlg.removeEventListener('click', onClick); resolve(false); };
      dlg.addEventListener('click', onClick);
      dlg.addEventListener('close', onClose, { once: true });
    });
  }

  /* ───────────── one-time code dialog ───────────── */
  let otpTimer = null;
  function otpModal(info, flow) {
    S.otpFlow = flow;
    openModal(`<h2 id="modal-title" class="modal-title">${esc(flow.title)}</h2>
      <p>${t('We sent a 6-digit code to')} <b>${esc(info.sent_to)}</b>. ${t('It expires in')} ${info.expires_in_min} ${t('minutes')}.</p>
      ${info.dev_code ? `<p class="devcode">${t('Demo mode: no SMS or email service is set up yet, so the code is shown here.')}
        <b>${esc(info.dev_code)}</b> <button type="button" class="link" data-action="otp-fill" data-code="${esc(info.dev_code)}">${t('Fill it in')}</button></p>` : ''}
      <form data-form="otp" class="stack">
        <label class="field"><span>${t('6-digit code')}</span>
          <input class="otp-input" name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"></label>
        ${errBox}
        <div class="actions"><button type="button" class="btn btn-ghost" data-action="otp-resend" disabled>${t('Send a new code')}</button>
          <button class="btn btn-primary" type="submit">${t('Verify')}</button></div>
      </form>`);
    $('.otp-input', dlg).focus();
    clearInterval(otpTimer);
    let left = 30;
    const btn = $('[data-action="otp-resend"]', dlg);
    const tickDown = () => {
      if (!document.body.contains(btn)) return clearInterval(otpTimer);
      left -= 1;
      btn.disabled = left > 0;
      btn.textContent = t('Send a new code') + (left > 0 ? ` (${left})` : '');
      if (left <= 0) clearInterval(otpTimer);
    };
    tickDown();
    otpTimer = setInterval(tickDown, 1000);
  }

  /* ───────────── Firebase (Auth & Firestore) ───────────── */
  const FB_VERSION = '10.14.1';
  const loadScript = (src) => new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = src; sc.onload = res;
    sc.onerror = () => { sc.remove(); rej(new Error(t('Something went wrong.'))); };
    document.head.appendChild(sc);
  });
  async function loadFirebase(libs = []) {
    const cfg = S.meta.firebase;
    if (!cfg) throw new Error('Firebase is not set up.');
    if (!window.firebase?.initializeApp) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app-compat.js`);
    for (const lib of libs) if (!window.firebase[lib]) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-${lib}-compat.js`);
    if (!firebase.apps.length) firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
    return window.firebase;
  }
  function fbError(e) {
    const m = {
      'auth/invalid-verification-code': 'That code is not right.', 'auth/code-expired': 'This code has expired. Ask for a new one.',
      'auth/too-many-requests': 'Too many tries. Please wait a while and try again.', 'auth/invalid-phone-number': 'Enter a valid 10-digit Indian mobile number.',
      'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups and try again.', 'auth/unauthorized-domain': 'This website is not on Firebase\'s list of allowed domains.',
    };
    return m[e?.code] || e?.message || t('Something went wrong.');
  }

  /* ───────────── reCAPTCHA lifecycle (strictly for Phone OTP only) ───────────── */
  function resetRecaptcha() {
    if (window.__b2bCaptcha) {
      try { window.__b2bCaptcha.clear(); } catch { /* already cleared */ }
      window.__b2bCaptcha = null;
    }
    const box = document.getElementById('recaptcha-box');
    if (box) box.remove();
  }

  function getRecaptchaContainer() {
    resetRecaptcha();
    const box = document.createElement('div');
    box.id = 'recaptcha-box';
    box.setAttribute('aria-hidden', 'true');
    box.style.display = 'none';
    document.body.appendChild(box);
    return box;
  }

  async function startOtp(info, flow) {
    // reCAPTCHA is strictly restricted to Firebase phone OTP authentication only.
    // Email/password login, email OTP, and local dev modes must NEVER initialize or require reCAPTCHA.
    const isFirebasePhone = info?.channel === 'phone' && info?.provider === 'firebase' && !!info?.phone_e164;
    if (!isFirebasePhone) return otpModal(info, flow);

    const fb = await loadFirebase(['auth']);
    let confirmation;
    const send = async () => {
      const container = getRecaptchaContainer();
      try {
        window.__b2bCaptcha = new fb.auth.RecaptchaVerifier(container, { size: 'invisible' });
        confirmation = await fb.auth().signInWithPhoneNumber(info.phone_e164, window.__b2bCaptcha);
      } catch (e) {
        resetRecaptcha();
        throw new Error(fbError(e));
      }
    };
    await send();
    otpModal(info, {
      title: flow.title,
      resend: async () => { await send(); return info; },
      async verifyWith({ code }) {
        let cred;
        try { cred = await confirmation.confirm(code); } catch (e) { throw new Error(fbError(e)); }
        const token = await cred.user.getIdToken();
        await fb.auth().signOut();
        resetRecaptcha();
        return flow.verifyWith({ firebase_id_token: token });
      },
    });
  }

  /* ───────────── live updates (Firestore / SSE) ───────────── */
  let liveES = null, liveOff = [], boardOff = null, refreshTimer = null;
  function liveStop() { liveES?.close(); liveES = null; liveOff.forEach((f) => f()); liveOff = []; boardOff?.(); boardOff = null; }
  async function liveStart() {
    liveStop();
    if (!S.token) return;
    if (S.meta.firebase?.live && S.inboxId) {
      try {
        const fb = await loadFirebase(['firestore']);
        liveOff.push(fb.firestore().doc('inbox/' + S.inboxId).onSnapshot((d) => d.exists && onLive({ type: 'notify', unread: d.data().unread }), () => {}));
        return;
      } catch { /* fall through to SSE */ }
    }
    liveES = new EventSource('/api/events?token=' + encodeURIComponent(S.token));
    liveES.onmessage = (e) => { try { onLive(JSON.parse(e.data)); } catch { /* ignore */ } };
  }
  async function watchBoard(reqId) {
    if (!S.meta.firebase?.live) return;
    try {
      const fb = await loadFirebase(['firestore']);
      let first = true;
      boardOff = fb.firestore().doc('boards/' + reqId).onSnapshot(() => { if (first) { first = false; return; } onLive({ type: 'board', req: Number(reqId) }); }, () => {});
    } catch { /* live board is a bonus */ }
  }
  function onLive(ev) {
    if (ev.type === 'notify') {
      S.unread = ev.unread;
      const b = $('#badge'); if (b) { b.textContent = ev.unread; b.hidden = !ev.unread; }
      if (ev.unread) softRefresh();
    }
    if (ev.type === 'board' && (location.hash === '#/requirement/' + ev.req || location.hash === '#/buyer/auctions')) softRefresh();
  }
  function softRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const typing = document.activeElement?.matches?.('input, textarea, select');
      const livePage = /^#\/(requirement\/|deal\/|deals$|track|payments$|buyer\/(jobs|auctions)$|operator\/(bids|jobs)$|farmer$)/.test(location.hash);
      if (!dlg.open && !typing && livePage) render({ keepScroll: true });
    }, 500);
  }

  /* ───────────── photos: shrink before upload, show with auth ───────────── */
  async function photoPayload(file, max = 1600) {
    if (!file) throw new Error(t('Something went wrong.'));
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return { mime: 'image/jpeg', image: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
  }
  async function showPhotos(dealId) {
    for (const img of document.querySelectorAll('img[data-photo]')) {
      try {
        const res = await fetch(`/api/deals/${dealId}/photos/${img.dataset.photo}`, { headers: { Authorization: 'Bearer ' + S.token } });
        if (res.ok) img.src = URL.createObjectURL(await res.blob());
      } catch { /* leave the placeholder */ }
    }
  }

  /* ───────────── form building blocks ───────────── */
  const field = (label, name, o = {}) => `
    <label class="field ${o.cls || ''}"><span>${t(label)}</span>
      <input name="${name}" type="${o.type || 'text'}" ${o.req === false ? '' : 'required'} ${o.attrs || ''}
        value="${esc(o.value ?? '')}" ${o.placeholder ? `placeholder="${esc(t(o.placeholder))}"` : ''} ${o.live ? `data-live="${o.live}"` : ''}>
      ${o.hint ? `<small>${t(o.hint)}</small>` : ''}</label>`;
  const textarea = (label, name, o = {}) => `
    <label class="field ${o.cls || ''}"><span>${t(label)}</span>
      <textarea name="${name}" rows="${o.rows || 3}" ${o.req ? 'required' : ''} maxlength="${o.max || 500}" ${o.placeholder ? `placeholder="${esc(t(o.placeholder))}"` : ''}>${esc(o.value ?? '')}</textarea></label>`;
  const select = (label, name, options, value, o = {}) => `
    <label class="field ${o.cls || ''}"><span>${t(label)}</span>
      <select name="${name}" ${o.req ? 'required' : ''} ${o.live ? `data-live="${o.live}"` : ''}>
        ${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select></label>`;
  const stateOptions = (blank) => [...(blank ? [['', t(blank)]] : []), ...S.meta.states.map((s) => [s, s])];
  const cropOptions = (blank) => [...(blank ? [['', t(blank)]] : []), ...S.meta.crops.map((c) => [c.key, t(c.label)])];
  const errBox = '<p class="form-error" role="alert"></p>';
  const showErr = (form, e) => { const b = $('.form-error', form); if (b) b.textContent = e.message; else toast(e.message, 'error'); };
  const formObj = (form) => Object.fromEntries(new FormData(form));
  const loading = () => `<p class="loading">${t('Loading…')}</p>`;

  /* ───────────── chrome: header / footer ───────────── */
  function header() {
    const u = S.user;
    const hash = location.hash || '#/';
    const on = (href) => hash === href || (href !== '#/' && hash.startsWith(href + '/'));
    const link = (href, label, icn) => `<a href="${href}" class="${on(href) ? 'active' : ''}" ${on(href) ? 'aria-current="page"' : ''}>${icn ? icon(icn, 16) : ''}<span>${t(label)}</span></a>`;
    let links = '';
    const common = () => link('#/deals', 'Deals', 'shield') + link('#/track', 'Track', 'truck') + link('#/payments', 'Payments', 'wallet');
    if (u?.role === 'farmer') {
      links += link('#/farmer', 'Dashboard', 'wheat') + link('#/farmer/new', 'Post land', 'sparkles') + common();
    } else if (u?.role === 'buyer') {
      links += link('#/buyer/find', 'Marketplace', 'wheat') + link('#/buyer/auctions', 'Auctions', 'trophy') + link('#/buyer/jobs', 'Dashboard', 'factory') + common();
    } else if (u?.role === 'operator') {
      links += link('#/operator/jobs', 'Jobs', 'tractor') + link('#/operator/bids', 'My bids', 'coins') + common();
    } else {
      links += link('#/', 'Home') + `<a href="#/how-it-works">${t('How It Works')}</a>` + link('#/buyer/find', 'Marketplace') + link('#/operator/jobs', 'Find Transport') + link('#/tech', 'Built with Google');
    }
    const initials = u ? (u.company || u.name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '';
    const roleLabel = u ? t({ farmer: 'Farmer', buyer: 'Buyer', operator: 'Operator' }[u.role]) : '';

    return `
    <header class="topbar" data-role="${u ? u.role : ''}">
      <div class="topbar-inner">
        <a class="brand" href="${u ? homeFor(u.role) : '#/'}" aria-label="${t('Bale to Brick')}">${brandLogo()}</a>
        <nav class="nav" id="main-nav" aria-label="Main">${links}</nav>
        <div class="bar-tools">
          <button class="btn-tool lang" data-action="lang" aria-label="Language">${S.lang === 'hi' ? 'EN' : 'हिं'}</button>
          ${u ? `
            <div class="bell-wrap">
              <button class="btn-tool bell" data-action="bell" aria-label="${t('Notifications')}" aria-expanded="false">
                ${icon('bell', 18)}
                <span class="badge" id="badge" ${S.unread ? '' : 'hidden'}>${S.unread}</span>
              </button>
              <div class="notif-panel" id="notif-panel" hidden></div>
            </div>
            <div class="acct-wrap">
              <button class="acct" data-action="account" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(u.company || u.name)}">
                <span class="acct-av">${esc(initials)}</span>
                <span class="acct-name"><b>${esc((u.company || u.name).slice(0, 22))}</b><small>${roleLabel}</small></span>
              </button>
              <div class="acct-menu" id="acct-menu" role="menu" hidden>
                <p class="acct-head"><b>${esc(u.name)}</b><small>${esc(u.email)}</small></p>
                <a role="menuitem" href="#/profile">${icon('user', 15)} <span>${t('Profile')}</span></a>
                <a role="menuitem" href="#/payments">${icon('wallet', 15)} <span>${t('Payments')}</span></a>
                <a role="menuitem" href="#/tech">${icon('sparkles', 15)} <span>${t('Built with Google')}</span></a>
                <button role="menuitem" data-action="logout">${t('Log out')}</button>
              </div>
            </div>`
          : `<a class="btn-tool login-link" href="#/login/farmer">${t('Log in')}</a>
             <a class="btn btn-primary btn-sm cta-start" href="#/register/farmer">${t('Get Started')}</a>`}
          <button class="btn-tool burger" data-action="menu" aria-controls="main-nav" aria-expanded="false" aria-label="${t('Menu')}">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>`;
  }

  const footer = () => `
  <footer class="foot">
    <div class="foot-content">
      <div class="foot-brand">
        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.75rem;">
          ${brandLogo()}
        </div>
        <p>${t('Turning agricultural crop residue into clean industrial energy and building bricks while ending toxic farm fires forever.')}</p>
        <p class="small muted" style="margin-top:0.75rem;">${t('Bale to Brick connects the three sides and keeps the agreement on record. The buyer pays into escrow; the operator and farmer are paid when the field is confirmed clear.')}</p>
      </div>
      <div class="foot-col">
        <h4>${t('For Farmers')}</h4>
        <ul>
          <li><a href="#/register/farmer">${t('Post Crop Stubble')}</a></li>
          <li><a href="#/login/farmer">${t('Farmer Portal')}</a></li>
          <li><a href="#/how-it-works">${t('Zero-Burn Verification')}</a></li>
          <li><a href="#/how-it-works">${t('Jamabandi Land Scan')}</a></li>
        </ul>
      </div>
      <div class="foot-col">
        <h4>${t('For Industry & Fleet')}</h4>
        <ul>
          <li><a href="#/buyer/find">${t('Biomass Marketplace')}</a></li>
          <li><a href="#/operator/jobs">${t('Baler & Truck Jobs')}</a></li>
          <li><a href="#/how-it-works">${t('Reverse Bidding Engine')}</a></li>
          <li><a href="#/register/buyer">${t('Industrial Procurement')}</a></li>
        </ul>
      </div>
      <div class="foot-col">
        <h4>${t('Google Agritech Stack')}</h4>
        <ul>
          <li><a href="#/tech">Gemini 1.5 Multimodal AI</a></li>
          <li><a href="#/tech">Google Earth Engine (Sentinel-2)</a></li>
          <li><a href="#/tech">Google Routes & Hauling API</a></li>
          <li><a href="#/tech">Firebase Auth & Firestore</a></li>
          <li><a href="#/tech">Google Cloud Vision & Vertex AI</a></li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <div>© 2026 Bale to Brick • National Agritech Innovation Platform</div>
      <div>
        <a href="#/tech" style="color:var(--straw-gold);text-decoration:none;font-weight:700;">★ ${t('Built with Google')}</a>
      </div>
    </div>
  </footer>`;

  const verifyBanner = () => (S.user && !S.user.email_verified && !S.user.phone_verified && location.hash !== '#/profile'
    ? `<div class="verify-banner"><p>${t('Verify your mobile number or email so others know your account is real.')} <a href="#/profile">${t('Verify now')}</a></p></div>` : '');
  const page = (inner, cls = '') => `${header()}${verifyBanner()}<main id="main" class="page ${cls}">${inner}</main>${footer()}`;

  /* ───────────── landing ───────────── */
  function heroArt() {
    let stalks = '';
    for (let i = 0; i < 40; i++) {
      const x = 14 + i * 6.2, h = 46 + ((i * 37) % 38), tilt = ((i * 13) % 9) - 4;
      stalks += `<line x1="${x}" y1="300" x2="${x + tilt}" y2="${300 - h}"/>`;
    }
    const baleX = 520, baleR = 56;
    const bale = `<g class="art-bale"><circle cx="${baleX}" cy="${300 - baleR}" r="${baleR}"/>
      ${[42, 29, 17, 7].map((r) => `<circle class="ring" cx="${baleX}" cy="${300 - baleR}" r="${r}"/>`).join('')}
      <line class="strap" x1="${baleX - baleR + 6}" y1="${300 - baleR - 22}" x2="${baleX + baleR - 6}" y2="${300 - baleR - 22}"/>
      <line class="strap" x1="${baleX - baleR + 6}" y1="${300 - baleR + 22}" x2="${baleX + baleR - 6}" y2="${300 - baleR + 22}"/></g>`;
    let bricks = '', n = 0;
    const bw = 60, bh = 27, gap = 4, wallX = 800;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        const off = row % 2 ? bw / 2 + gap / 2 : 0;
        const x = wallX + col * (bw + gap) - off;
        if (x < wallX - 2 || x + bw > wallX + 6 * (bw + gap) - gap + 2) continue;
        const y = 300 - (row + 1) * (bh + gap) + gap;
        bricks += `<rect class="brick" style="animation-delay:${(0.5 + n * 0.045).toFixed(2)}s" x="${x}" y="${y}" width="${bw}" height="${bh}"/>`;
        n++;
      }
    }
    return `<svg viewBox="0 100 1200 240" role="img" focusable="false">
      <line class="ground" x1="0" y1="300" x2="1200" y2="300"/>
      <g class="stalks">${stalks}</g>
      <path class="flow" d="M290 262 C340 262 380 262 440 262"/><path class="flow" d="M610 262 C660 262 700 262 780 262"/>
      ${bale}${bricks}
      <text x="150" y="328" class="art-label">${t('Field')}</text>
      <text x="${baleX}" y="328" class="art-label" text-anchor="middle">${t('Bale')}</text>
      <text x="${wallX + 190}" y="328" class="art-label" text-anchor="middle">${t('Kiln')}</text></svg>`;
  }

  function updateLandingCalc() {
    const cropEl = $('#calc-crop');
    const acresEl = $('#calc-acres');
    if (!cropEl || !acresEl) return;
    const tpaMap = { paddy: 2.5, wheat: 1.6, sugarcane: 3.0, cotton: 1.2, mustard: 1.2, other: 1.5 };
    const acres = Number(acresEl.value) || 25;
    const tpa = tpaMap[cropEl.value] || 2.5;
    const tonnes = Math.round(acres * tpa * 10) / 10;
    const bricks = Math.round(tonnes * 3800);
    const coal = Math.round(tonnes * 0.55 * 10) / 10;
    const co2 = Math.round(tonnes * 1.5 * 10) / 10;
    const acresVal = $('#calc-acres-val');
    if (acresVal) acresVal.textContent = acres;
    const tonnesEl = $('#calc-tonnes'); if (tonnesEl) tonnesEl.textContent = fmtNum(tonnes);
    const bricksEl = $('#calc-bricks'); if (bricksEl) bricksEl.textContent = fmtNum(bricks);
    const coalEl = $('#calc-coal'); if (coalEl) coalEl.textContent = fmtNum(coal) + ' t';
    const co2El = $('#calc-co2'); if (co2El) co2El.textContent = fmtNum(co2) + ' t';
  }

  function viewLanding() {
    afterRender = () => {
      loadStats();
      updateLandingCalc();
      loadShowcase();
    };
    const ladder = [['Rajdhani Baling', 71000, 5], ['Haryana Agri Machinery', 62000, 6], ['Kisan Baler Services', 58000, 7]];
    return page(`
    <!-- CINEMATIC AGRICULTURAL HERO -->
    <section class="landing-hero">
      <div class="hero-content">
        <div class="hero-copy">
          <div class="hero-pill">
            <span class="dot"></span>
            <span>${t('National Agritech Initiative • Zero Stubble Burning')}</span>
          </div>
          <h1>${t('Turning Farm Waste Into')} <span class="highlight-text">${t('Valuable Resources.')}</span></h1>
          <p class="lede">${t('India’s AI-powered agritech marketplace connecting farmers with crop residue, brick kilns & bioenergy industries, and local tractor/baler operators via real-time reverse bidding.')}</p>
          <div class="cta-group">
            <a class="btn btn-operator btn-lg" href="#/buyer/find">${icon('search', 18)} <span>${t('Explore Marketplace')}</span></a>
            <a class="btn btn-farmer btn-lg" href="#/register/farmer">${icon('sparkles', 18)} <span>${t('Get Started')}</span></a>
          </div>
          <p class="small hero-login">
            ${t('Already registered?')} <a href="#/login/farmer">${t('Log in')}</a>
            <span class="hero-sep" aria-hidden="true">|</span>
            <a href="#/login/buyer" data-action="fill-demo" data-role="buyer">⚡ ${t('Quick Demo Login')}</a>
          </p>
        </div>
        <div class="hero-cards-col">
          <div class="hero-glass-card">
            <div class="glass-card-icon" style="color:var(--ok);">${icon('satellite', 26)}</div>
            <div class="glass-card-content">
              <h4>${t('Zero-Burn Verified')}</h4>
              <p>Sentinel-2 & NASA FIRMS thermal satellites ensure 100% field compliance.</p>
            </div>
          </div>
          <div class="hero-glass-card">
            <div class="glass-card-icon" style="color:var(--straw-gold);">${icon('trophy', 26)}</div>
            <div class="glass-card-content">
              <h4>${t('Live Reverse Bidding')}</h4>
              <p>Local balers compete downward, reducing hauling costs by up to 35%.</p>
            </div>
          </div>
          <div class="hero-glass-card">
            <div class="glass-card-icon" style="color:#f2ba49;">${icon('coins', 26)}</div>
            <div class="glass-card-content">
              <h4>${t('Direct Farmer Income')}</h4>
              <p>Earn ₹1,500 – ₹3,000 per acre instead of burning crop stubble into toxic smoke.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- LIVE STATS STRIP -->
    <section class="stats-strip">
      <div class="stats-grid" id="stats" aria-live="polite">
        <div class="stat-card"><b>...</b><span>${t('acres listed')}</span></div>
        <div class="stat-card"><b>...</b><span>${t('tonnes of stubble kept out of the fire')}</span></div>
        <div class="stat-card"><b>...</b><span>${t('deals completed')}</span></div>
        <div class="stat-card"><b>...</b><span>${t('operators on the platform')}</span></div>
      </div>
    </section>

    <!-- THREE WAYS TO PARTICIPATE -->
    <section class="roles-section">
      <div class="section-header">
        <span class="section-tag">${t('Three Ways to Participate')}</span>
        <h2>${t('A Unified Marketplace for All Three Sides')}</h2>
        <p>${t('Empowering farmers, industrial biomass buyers, and machinery transport operators to create economic value from agricultural residue.')}</p>
      </div>
      <div class="roles-grid">
        <article class="role-portal-card card-farmer">
          <div class="role-icon-badge">${icon('wheat', 28)}</div>
          <h3>${t('Turn Stubble Into Income')}</h3>
          <p>${t('Post the acres, the crop and the date the field must be clear. Nobody burns, nobody chases buyers.')}</p>
          <div class="role-card-actions">
            <a class="btn btn-farmer btn-sm" href="#/register/farmer">${t('Sign up')}</a>
            <a class="link small" href="#/login/farmer">${t('Log in')} →</a>
          </div>
        </article>
        <article class="role-portal-card card-buyer">
          <div class="role-icon-badge">${icon('factory', 28)}</div>
          <h3>${t('Sustainably Fuel Your Kiln')}</h3>
          <p>${t('Set your region, crop and price. See the best matches first, then say how much you will pay and by when.')}</p>
          <div class="role-card-actions">
            <a class="btn btn-buyer btn-sm" href="#/register/buyer">${t('Sign up')}</a>
            <a class="link small" href="#/login/buyer">${t('Log in')} →</a>
          </div>
        </article>
        <article class="role-portal-card card-operator">
          <div class="role-icon-badge">${icon('tractor', 28)}</div>
          <h3>${t('Bid, Bale & Transport')}</h3>
          <p>${t('Browse open jobs near you and promise a price and a number of days. Each new bid has to beat your last one.')}</p>
          <div class="role-card-actions">
            <a class="btn btn-operator btn-sm" href="#/register/operator">${t('Sign up')}</a>
            <a class="link small" href="#/login/operator">${t('Log in')} →</a>
          </div>
        </article>
      </div>
    </section>

    <!-- HOW IT WORKS SECTION (6 CONNECTED STEPS) -->
    <section class="how-section" id="how-it-works">
      <div class="section-header">
        <span class="section-tag">${t('How a job moves')}</span>
        <h2>${t('Six Connected Steps from Field to Furnace')}</h2>
        <p>${t('An end-to-end transparent process powered by Gemini AI, Satellite verification, and live reverse auctions.')}</p>
      </div>
      <div class="how-flow-grid">
        <div class="step-card">
          <div class="step-num">1</div>
          <h4>${t('Farmer Lists Stubble')}</h4>
          <p>${t('A farmer lists the land with the date it must be clear.')} Speak in Hindi or scan Jamabandi land record.</p>
        </div>
        <div class="step-card">
          <div class="step-num">2</div>
          <h4>${t('Industry Matches Land')}</h4>
          <p>${t('A buyer picks it and names a budget and a deadline.')} Ranked by distance and crop match score.</p>
        </div>
        <div class="step-card">
          <div class="step-num">3</div>
          <h4>${t('Live Reverse Auction')}</h4>
          <p>${t('Operators bid down. Every revision must be lower, or the same price in fewer days.')}</p>
        </div>
        <div class="step-card">
          <div class="step-num">4</div>
          <h4>${t('Deal Sealed Transparently')}</h4>
          <p>${t('The buyer compares price, days, equipment and rating, then seals the deal.')} Contact and exact GPS unlock.</p>
        </div>
        <div class="step-card">
          <div class="step-num">5</div>
          <h4>${t('Baling & Hauling with Proof')}</h4>
          <p>${t('The operator bales and hauls. The farmer confirms the field is clear.')} Proof photos inspected by Cloud Vision.</p>
        </div>
        <div class="step-card">
          <div class="step-num">6</div>
          <h4>${t('Satellite Zero-Burn Verified')}</h4>
          <p>Sentinel-2 & NASA FIRMS satellites confirm zero burning. Farmers, industries and haulers all benefit.</p>
        </div>
      </div>

      <!-- REVERSE BIDDING DEMO SHOWCASE -->
      <aside class="auction-showcase" aria-label="${t('An example job')}">
        <div>
          <span class="pill pill-open" style="margin-bottom:0.6rem;">${icon('trophy', 14)} ${t('Live Reverse Auction')}</span>
          <h3>${t('An example job')}</h3>
          <p class="muted">${t('20 acres of paddy straw in Karnal. Budget ₹90,000, needed within 8 days.')}</p>
          <p class="small">${t('The lowest price is not the only thing that counts. The buyer can choose a faster crew or a better-rated one.')}</p>
        </div>
        <div>
          <ul class="mini-ladder">${ladder.map(([n, p, d], i) => `
            <li class="${i === 2 ? 'best' : ''}">
              <span><b>${i === 2 ? '★ ' : ''}${t(n)}</b></span>
              <b>${inr(p)}</b>
              <span>${d} ${t('days')}</span>
            </li>`).join('')}</ul>
        </div>
      </aside>
    </section>

    <!-- ENVIRONMENTAL CALCULATOR SECTION -->
    <section class="impact-calculator-section" id="impact-calculator">
      <div class="calc-wrapper">
        <div class="calc-info">
          <span class="section-tag">🌱 ${t('Environmental Savings')}</span>
          <h3>${t('Calculate Environmental Impact')}</h3>
          <p>${t('Select crop and land area to estimate residue value and emissions avoided')}</p>
          <div style="display:flex;flex-direction:column;gap:1.1rem;margin-top:1.5rem;">
            <label style="display:grid;gap:0.35rem;">
              <span class="calc-label">${t('Crop residue')}</span>
              <select id="calc-crop" data-live="landing-calc">
                <option value="paddy" style="color:#000;">${t('Paddy (rice) straw')}</option>
                <option value="wheat" style="color:#000;">${t('Wheat straw')}</option>
                <option value="sugarcane" style="color:#000;">${t('Sugarcane trash')}</option>
                <option value="cotton" style="color:#000;">${t('Cotton stalks')}</option>
                <option value="mustard" style="color:#000;">${t('Mustard stalks')}</option>
              </select>
            </label>
            <label style="display:grid;gap:0.35rem;">
              <span class="calc-label">${t('Land area (acres)')}: <b id="calc-acres-val">25</b> ${t('acres')}</span>
              <input type="range" id="calc-acres" min="1" max="200" value="25" step="1" data-live="landing-calc" style="accent-color:var(--straw-gold);">
            </label>
          </div>
        </div>
        <div class="calc-grid">
          <div class="calc-metric-box">
            <b id="calc-tonnes">62.5</b>
            <span>${t('tonnes of residue')}</span>
          </div>
          <div class="calc-metric-box">
            <b id="calc-bricks">237,500</b>
            <span>${t('bricks it can fire')}</span>
          </div>
          <div class="calc-metric-box">
            <b id="calc-coal">34.4 t</b>
            <span>${t('tonnes of coal replaced')}</span>
          </div>
          <div class="calc-metric-box">
            <b id="calc-co2">93.8 t</b>
            <span>${t('tonnes of CO₂ not released')}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- RECENT SUCCESSFUL DEALS + LIVE AUCTIONS (filled from /api/showcase) -->
    <section class="showcase-section" id="showcase">
      <div class="section-header">
        <span class="section-tag">${t('Proof it works')}</span>
        <h2>${t('Deals closed on Bale to Brick')}</h2>
        <p>${t('Real flows from the demo marketplace: who bid, what the buyer paid, how fast the field was cleared.')}</p>
      </div>
      <div id="showcase-live" class="live-strip"></div>
      <div id="showcase-deals" class="success-grid">${loading()}</div>
    </section>

    <!-- FIELD → BALE → KILN, IN PHOTOS -->
    <section class="journey-section">
      <div class="section-header">
        <span class="section-tag">${t('Field to Kiln Logistics')}</span>
        <h2>${t('From a burning problem to a brick kiln’s fuel')}</h2>
      </div>
      <ol class="journey">
        ${[
          ['field', 'Late_summer_straw_field_Ontario_County_NY_01.jpg', 'Field', 'Harvested field with loose straw. The farmer lists it instead of setting it on fire.'],
          ['bale', 'Harvest_Straw_Bales_in_Schleswig-Holstein.jpg', 'Bale', 'The winning operator rakes, bales and loads the straw within the promised days.'],
          ['kiln', 'Indian_brick_kiln.jpg', 'Kiln', 'Bales reach the brick kiln or biomass plant and replace coal in the firing.'],
        ].map(([k, file, title, text], i) => `
        <li class="journey-step journey-${k}">
          <figure>
            <img src="https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=900" alt="${esc(t(title))}" loading="lazy" decoding="async" data-fallback="${k}" width="900" height="600">
            <figcaption><a href="https://commons.wikimedia.org/wiki/File:${file}" target="_blank" rel="noopener">${t('Photo')}: Wikimedia Commons</a></figcaption>
          </figure>
          <div class="journey-copy">
            <span class="journey-num">${i + 1}</span>
            <h3>${t(title)}</h3>
            <p>${t(text)}</p>
          </div>
        </li>`).join('')}
      </ol>
    </section>
    `, 'landing');
  }

  async function loadShowcase() {
    let d;
    try { d = await api('/showcase'); } catch { return; }
    const box = $('#showcase-deals'), live = $('#showcase-live');
    if (!box) return;
    live.innerHTML = d.live.length ? `<p class="live-title"><span class="live-dot">${t('Live')}</span> ${t('Auctions running now')}</p>
      <div class="live-cards">${d.live.map((a) => `<div class="live-card">
        <b>${fmtNum(a.acres)} ${t('acres')} · ${cropLabel(a.crop)}</b>
        <span class="muted small">${esc(a.district)}, ${esc(a.state)}</span>
        <span class="live-num">${a.lowest_bid ? inr(a.lowest_bid) : '—'} <small>${a.bid_count} ${t(a.bid_count === 1 ? 'bid' : 'bids')}</small></span>
        <span class="small muted">${t('Budget')} ${inr(a.budget_total)}${a.drop_pct > 0 ? ` · <b class="down">−${a.drop_pct}%</b>` : ''}</span>
      </div>`).join('')}</div>` : '';
    box.innerHTML = d.deals.slice(0, 3).map((x) => `
      <article class="success-card">
        <header><span class="pill pill-completed">✓ ${t('Completed')}</span><span class="small muted">${fmtDate(x.completed_at)}</span></header>
        <h3>${fmtNum(x.acres)} ${t('acres of')} ${cropLabel(x.crop)}</h3>
        <p class="muted small">${icon('mapPin', 13)} ${esc(x.village ? x.village + ', ' : '')}${esc(x.district)}, ${esc(x.state)}</p>
        <dl class="success-figs">
          <div><dt>${t('Buyer budget')}</dt><dd>${inr(x.budget_total)}</dd></div>
          <div><dt>${t('Won at')}</dt><dd class="hl">${inr(x.price_total)}</dd></div>
          <div><dt>${t('Bids')}</dt><dd>${x.bid_count}</dd></div>
          <div><dt>${t('Cleared in')}</dt><dd>${x.days_taken} ${t(x.days_taken === 1 ? 'day' : 'days')}</dd></div>
        </dl>
        <p class="success-parties">${icon('tractor', 14)} ${esc(x.operator)} <span class="muted">→</span> ${icon('factory', 14)} ${esc(x.buyer)}</p>
        ${x.comment ? `<blockquote>“${esc(x.comment)}” ${x.stars ? `<span class="rating">★ ${x.stars}</span>` : ''}</blockquote>` : ''}
        <p class="small ok-line">${icon('leaf', 13)} ${fmtNum(x.tonnes)} ${t('tonnes kept out of the fire')}${x.farmer_paid ? ` · ${t('farmer earned')} ${inr(x.farmer_paid)}` : ''}</p>
      </article>`).join('') || `<p class="muted">${t('Completed deals will show up here.')}</p>`;
  }

  async function loadStats() {
    try {
      const s = await api('/stats');
      const el = $('#stats');
      if (!el) return;
      el.innerHTML = [
        [s.acres_listed, 'acres listed'], [s.tonnes_diverted, 'tonnes of stubble kept out of the fire'],
        [s.deals_completed, 'deals completed'], [s.operators, 'operators on the platform'],
      ].map(([n, l]) => `<div class="stat-card"><b>${fmtNum(n)}</b><span>${t(l)}</span></div>`).join('');
    } catch { /* stats are optional */ }
  }

  /* ───────────── auth ───────────── */
  const ROLES = ['farmer', 'buyer', 'operator'];
  const roleName = (r) => t({ farmer: 'Farmer', buyer: 'Buyer', operator: 'Operator' }[r]);

  function roleTabs(mode, role) {
    return `<div class="role-tabs" role="tablist">${ROLES.map((r) =>
      `<a role="tab" aria-selected="${r === role}" class="tab tab-${r} ${r === role ? 'on' : ''}" href="#/${mode}/${r}">${roleName(r)}</a>`).join('')}</div>`;
  }

  const DEMO_USERS = {
    farmer: [['farmer@demo.in', '9876500001', 'Gurpreet Singh', 'Sangrur, Punjab · completed + live deals'], ['farmer2@demo.in', '9876500002', 'Ramesh Yadav', 'Karnal, Haryana · work in progress'], ['farmer5@demo.in', '9876500005', 'Harbhajan Singh', 'Ludhiana, Punjab · paid for stubble']],
    buyer: [['buyer@demo.in', '9876510001', 'Shree Ganesh Bricks', 'Ludhiana · 2 live auctions, payment due'], ['buyer2@demo.in', '9876510002', 'GreenFuel Biomass Energy', 'Panipat · live auction, order in progress'], ['buyer3@demo.in', '9876510003', 'Marudhar Bricks & Tiles', 'Jaipur · completed deals, refund']],
    operator: [['operator@demo.in', '9876520001', 'Kisan Baler Services', 'Patiala · leading 2 auctions'], ['operator2@demo.in', '9876520002', 'Haryana Agri Machinery', 'Karnal · job in progress'], ['operator4@demo.in', '9876520004', 'Punjab Agro Balers', 'Ludhiana · bidding, crew on field']],
  };

  function viewLogin(role) {
    if (!ROLES.includes(role)) return go('#/login/farmer');
    const demoEmail = { farmer: 'farmer@demo.in', buyer: 'buyer@demo.in', operator: 'operator@demo.in' }[role];
    const demoPhone = { farmer: '9876500001', buyer: '9876510001', operator: '9876520001' }[role];
    const canOtp = S.meta.otp.email || S.meta.otp.phone;
    const otpMode = canOtp && S.loginOtp;
    const form = otpMode ? `
        <form data-form="login-otp" data-role="${role}" class="stack">
          ${field('Mobile number or email', 'who', { attrs: 'autocomplete="username" maxlength="120"', hint: 'Works with a mobile number or email you have verified.' })}
          ${errBox}
          <button class="btn btn-${role} btn-block" type="submit">${t('Send code')}</button>
        </form>` : `
        <form data-form="login" data-role="${role}" class="stack">
          ${field('Email', 'email', { type: 'email', attrs: 'autocomplete="email"' })}
          ${field('Password', 'password', { type: 'password', attrs: 'autocomplete="current-password"' })}
          ${errBox}
          <button class="btn btn-${role} btn-block" type="submit">${t('Log in')}</button>
        </form>`;
    return page(`
      <section class="auth auth-${role}">
        ${roleTabs('login', role)}
        <h1>${t({ farmer: 'Log in as a farmer', buyer: 'Log in as a buyer', operator: 'Log in as an operator' }[role])}</h1>
        ${form}
        ${googleButton(role)}
        ${canOtp ? `<p style="margin-top:1rem;"><button class="link" data-action="login-mode">${t(otpMode ? 'Log in with your password instead' : 'Log in with a one-time code instead')}</button></p>` : ''}
        <p style="margin-top:1rem;">${t('New here?')} <a href="#/register/${role}" style="font-weight:700;">${t('Create an account')}</a></p>
        ${S.meta.demo ? `<div class="demo">
          <p class="small muted">${otpMode ? t('Demo accounts: tap one to fill the mobile number.') : t('Demo accounts share the password demo1234. Tap one to log in.')}</p>
          <div class="demo-list">${DEMO_USERS[role].map(([email, phone, who, what]) => `
            <button type="button" class="demo-user" data-action="fill-demo" data-email="${email}" data-phone="${phone}">
              <span class="demo-av">${esc(who.split(' ').map((w) => w[0]).slice(0, 2).join(''))}</span>
              <span><b>${esc(who)}</b><small>${esc(what)}</small></span>
            </button>`).join('')}</div>
        </div>` : ''}
      </section>`, 'narrow');
  }

  function viewRegister(role) {
    if (!ROLES.includes(role)) return go('#/register/farmer');
    return page(`
      <section class="auth auth-${role}">
        ${roleTabs('register', role)}
        <h1>${t({ farmer: 'Create a farmer account', buyer: 'Create a buyer account', operator: 'Create an operator account' }[role])}</h1>
        <form data-form="register" data-role="${role}" class="stack">
          ${field('Full name', 'name', { attrs: 'autocomplete="name" maxlength="80"', value: S.googleSignup?.name || '' })}
          ${role === 'buyer' ? field('Company name', 'company', { attrs: 'maxlength="100"' }) : ''}
          ${role === 'operator' ? field('Business name', 'company', { attrs: 'maxlength="100"' }) : ''}
          <div class="two">
            ${field('Email', 'email', { type: 'email', attrs: `autocomplete="email" ${S.googleSignup ? 'readonly' : ''}`, value: S.googleSignup?.email || '' })}
            ${field('Mobile number', 'phone', { type: 'tel', attrs: 'autocomplete="tel" inputmode="numeric" maxlength="14"' })}
          </div>
          <div class="two">
            ${select('State', 'state', stateOptions(), 'Punjab', { req: true })}
            ${field('District', 'district', { attrs: 'maxlength="60"' })}
          </div>
          ${role === 'operator' ? `
            ${textarea('Equipment you have', 'equipment', { req: true, max: 300, placeholder: 'e.g. 2 balers, 1 rake, 3 trucks', rows: 2 })}
            ${field('Acres you can clear per day', 'capacity_acres_per_day', { type: 'number', attrs: 'min="1" max="1000" step="1"' })}` : ''}
          ${field('Password', 'password', { type: 'password', attrs: 'autocomplete="new-password" minlength="8" maxlength="72"', hint: 'At least 8 characters' })}
          ${channelPick()}
          ${errBox}
          <button class="btn btn-${role} btn-block" type="submit">${t('Sign up')}</button>
        </form>
        ${S.googleSignup ? '' : googleButton(role)}
        <p style="margin-top:1.2rem;">${t('Have an account?')} <a href="#/login/${role}" style="font-weight:700;">${t('Log in')}</a></p>
      </section>`, 'narrow');
  }

  const googleButton = (role) => (S.meta.firebase?.google_signin
    ? `<div class="or"><span>${t('or')}</span></div><button type="button" class="btn btn-google btn-block" data-action="google-signin" data-role="${role}">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
        ${t('Continue with Google')}</button>` : '');

  function channelPick() {
    if (S.googleSignup) return `<p class="small">${tick(true, 'Email verified with Google')}</p>`;
    const o = S.meta.otp;
    const chans = [['phone', 'Mobile number'], ['email', 'Email']].filter(([c]) => o[c]);
    if (!o.required || !chans.length) return '';
    return `<fieldset class="channel-pick"><legend>${t('Send my verification code to')}</legend>
      <div class="radios">${chans.map(([c, l], i) => `<label><input type="radio" name="otp_channel" value="${c}" ${i === 0 ? 'checked' : ''}> ${t(l)}</label>`).join('')}</div>
      <p class="small muted">${t('We send a 6-digit code to check that it is really yours.')} ${o.demo ? t('Demo mode: the code will be shown on screen.') : ''}</p></fieldset>`;
  }

  function startSession(data) {
    S.token = data.token; S.user = data.user;
    store.set('b2b_token', data.token);
    api('/me').then((me) => { S.inboxId = me.inbox_id; liveStart(); }).catch(() => {});
  }
  function endSession() {
    liveStop();
    resetRecaptcha();
    S.token = null; S.user = null; S.prefs = null; S.unread = 0; S.inboxId = null;
    store.set('b2b_token', null);
    go('#/');
  }

  /* ───────────── trust & impact cards (Gemini, Earth Engine, estimator) ───────────── */
  const SAT_TEXT = { harvested: 'Satellite: harvested', crop_standing: 'Satellite: crop still standing', partly_green: 'Satellite: partly green' };
  function trustChips(l) {
    const out = [];
    if (l.doc) out.push(`<span class="chip ${l.doc.name_match ? 'chip-ok' : 'chip-warn'}" title="${esc(l.doc.engine || '')}">${icon('shield', 14)} ${t('Land record checked')}${l.doc.name_match ? ' ✓' : ''}${l.doc.acres_match ? `, ${t('Area matches')}` : ''}</span>`);
    if (l.sat?.reading && SAT_TEXT[l.sat.reading]) out.push(`<span class="chip ${l.sat.reading === 'harvested' ? 'chip-ok' : ''}">${icon('satellite', 14)} ${t(SAT_TEXT[l.sat.reading])}</span>`);
    if (l.sat && l.sat.fire_days != null) out.push(`<span class="chip ${l.sat.fire_days ? 'chip-warn' : 'chip-ok'}">${icon('flame', 14)} ${l.sat.fire_days ? `${t('Fire seen on')} ${l.sat.fire_days} ${t('days')}` : t('No fire seen')}</span>`);
    return out.join('');
  }
  function docCard(d, withUse) {
    return `<div class="doc-card">
      <p>${d.name_match ? tick(true, 'Name matches your account') : `<span class="chip chip-warn">${t('Name does not match your account')}</span>`}</p>
      <dl class="facts">
        <div><dt>${t('Owner')}</dt><dd>${esc(d.owner_names.join(', ') || '—')}</dd></div>
        <div><dt>${t('Khasra')}</dt><dd>${esc(d.khasra_numbers.join(', ') || '—')}</dd></div>
        <div><dt>${t('Area')}</dt><dd>${esc(d.area_as_printed || '—')}${d.area_acres ? ` (${fmtNum(d.area_acres)} ${t('acres')})` : ''}</dd></div>
      </dl>
      ${withUse && d.area_acres ? `<button type="button" class="btn btn-ghost btn-sm" data-action="use-area" data-acres="${d.area_acres}">${t('Use this area')}</button>` : ''}
      <p class="small muted">${esc(d.document_type || '')} ${d.notes ? esc(d.notes) : ''} (${esc(d.engine)})</p></div>`;
  }
  function impactCard(e) {
    const cell = (n, l) => `<div><b>${fmtNum(n)}</b><span>${t(l)}</span></div>`;
    return `<div class="impact"><h3>${icon('leaf', 18)} ${t('If this residue is baled instead of burned')}</h3>
      <div class="impact-grid">${cell(e.tonnes, 'tonnes of residue')}${cell(e.bricks, 'bricks it can fire')}${cell(e.coal_replaced_t, 'tonnes of coal replaced')}
        ${cell(e.co2_avoided_t, 'tonnes of CO₂ not released')}${cell(e.pm25_avoided_kg, 'kg of PM2.5 smoke avoided')}</div>
      ${e.advice ? `<p>${esc(e.advice.summary)}</p><ul>${e.advice.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="small muted">${t('Rough estimates from average values.')}${e.engine ? ` (${esc(e.engine)})` : ''}</p></div>`;
  }

  /* ───────────── farmer experience ───────────── */
  async function viewFarmer() {
    const { items } = await api('/listings/mine');
    const live = items.filter((i) => i.status !== 'cancelled');
    const acres = live.reduce((a, i) => a + i.acres, 0);
    const cleared = live.filter((i) => i.status === 'completed').reduce((a, i) => a + i.acres, 0);
    const estTonnes = live.reduce((a, i) => a + (i.est_tonnes || (i.acres * 2.2)), 0);
    const activeCount = live.filter((i) => i.status === 'open' || i.status === 'claimed').length;
    const u = S.user;

    const rows = live.map((l) => {
      const dl = Math.round((Date.parse(l.clear_by) - Date.parse(S.meta.today)) / 86400000);
      let info = '', actions = '';
      if (l.status === 'open') {
        info = t('Waiting for a buyer to pick it.');
        actions = `<button class="btn btn-ghost btn-sm" data-action="cancel-listing" data-id="${l.id}">${t('Withdraw land')}</button>`;
      } else if (l.status === 'claimed') {
        info = `<b>${esc(l.buyer_company)}</b> ${t('picked it.')} ${l.bid_count} ${t(l.bid_count === 1 ? 'bid' : 'bids')}${l.lowest_bid ? `, ${t('lowest')} ${inr(l.lowest_bid)}` : ''}.`;
        actions = `<a class="btn btn-operator btn-sm" href="#/requirement/${l.req_id}">${t('See the job')}</a>
                   <button class="btn btn-ghost btn-sm" data-action="cancel-listing" data-id="${l.id}">${t('Withdraw land')}</button>`;
      } else if (l.deal_id) {
        info = `${t(DEAL_STATUS[l.deal_status])}, ${t('Due')} ${fmtDate(l.due_date)}`;
        actions = `<a class="btn btn-primary btn-sm" href="#/deal/${l.deal_id}">${t('Open the deal')}</a>`;
      }
      const sat = l.sat_json ? JSON.parse(l.sat_json) : null;
      const trust = trustChips({ doc: l.doc_json ? JSON.parse(l.doc_json) : null, sat: sat && { reading: sat.ground?.reading, fire_days: sat.fire?.fire_days?.length ?? null } });
      if ((S.int.earth_engine || S.int.firms) && l.lat != null && ['open', 'claimed'].includes(l.status)) {
        actions += `<button class="btn btn-ghost btn-sm" data-action="sat-check" data-id="${l.id}">${icon('satellite', 14)} ${t('Check from space')}</button>`;
      }
      return `<article class="row">
        <div class="row-main">
          <h3>${fmtNum(l.acres)} ${t('acres of')} ${cropLabel(l.crop)}</h3>
          <p class="muted">${icon('mapPin', 14)} ${place(l)}</p>
          ${trust ? `<p class="chips">${trust}</p>` : ''}
        </div>
        <div class="row-meta">
          <span>${icon('clock', 13)} ${t('Clear by')} ${fmtDate(l.clear_by)}</span>
          ${l.status === 'open' || l.status === 'claimed' ? `<span class="due ${urgencyClass(dl)}">${daysText(dl)}</span>` : ''}
        </div>
        <div class="row-status">
          ${pill(l.status, LISTING_STATUS[l.status])}
          <p>${info}</p>
        </div>
        <div class="row-actions">${actions}</div>
      </article>`;
    }).join('');

    return page(`
      <!-- FARMER WELCOME PROFILE BANNER -->
      <div class="hello-band hello-farmer">
        <div>
          <span class="pill pill-open">🌾 ${t('Farmer Portal')}</span>
          <h1>${t('Hello')}, ${esc(u.name || 'Kisan Ji')}</h1>
          <p class="hello-sub">${icon('mapPin', 14)} ${esc(u.village ? u.village + ', ' : '')}${esc(u.district)}, ${esc(u.state)} • ${tick(u.phone_verified, 'Verified mobile')}</p>
        </div>
        <a class="btn btn-operator btn-lg" href="#/farmer/new" style="box-shadow: 0 4px 14px rgba(229,169,60,0.35);">
          ${icon('sparkles', 18)} <span>${t('Post New Stubble / Land')}</span>
        </a>
      </div>

      <!-- FARMER KPI METRICS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.75rem;">
        <div class="panel" style="padding: 1.25rem; margin: 0; border-left: 5px solid var(--leaf-vibrant);">
          <span class="muted small">${t('Total Stubble Listed')}</span>
          <b style="display: block; font: 800 1.9rem/1.2 var(--display); color: var(--forest-dark); margin: 0.35rem 0 0.2rem;">${fmtNum(acres)} ${t('acres')}</b>
          <span class="small muted">~${fmtNum(estTonnes)} ${t('tonnes')} ${t('residue')}</span>
        </div>
        <div class="panel" style="padding: 1.25rem; margin: 0; border-left: 5px solid var(--ok);">
          <span class="muted small">${t('Cleared so far')}</span>
          <b style="display: block; font: 800 1.9rem/1.2 var(--display); color: var(--ok); margin: 0.35rem 0 0.2rem;">${fmtNum(cleared)} ${t('acres')}</b>
          <span class="small" style="color: var(--ok); font-weight: 700;">✓ 100% Zero-Burn</span>
        </div>
        <div class="panel" style="padding: 1.25rem; margin: 0; border-left: 5px solid var(--straw-gold);">
          <span class="muted small">${t('Active Offers')}</span>
          <b style="display: block; font: 800 1.9rem/1.2 var(--display); color: var(--straw-deep); margin: 0.35rem 0 0.2rem;">${activeCount}</b>
          <span class="small muted">${t('Open for buyers')}</span>
        </div>
        <div class="panel" style="padding: 1.25rem; margin: 0; border-left: 5px solid #2563eb;">
          <span class="muted small">${t('Environmental Savings')}</span>
          <b style="display: block; font: 800 1.9rem/1.2 var(--display); color: #2563eb; margin: 0.35rem 0 0.2rem;">${fmtNum(cleared * 1.5)} t</b>
          <span class="small muted">CO₂ & smoke kept out of air</span>
        </div>
      </div>

      <div class="page-head" style="margin-top: 1rem;">
        <div>
          <h2>${t('Your land')} (${live.length})</h2>
          <p class="muted">${t('Active plots open for brick kilns and baling operators.')}</p>
        </div>
      </div>
      ${rows ? `<div class="rows">${rows}</div>` : `<div class="empty">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🌾</div>
        <h2>${t('You have not posted any land yet.')}</h2>
        <p>${t('Post the acres and the date the field must be clear. Buyers near you will see it right away.')}</p>
        <a class="btn btn-farmer" href="#/farmer/new">${icon('sparkles', 16)} <span>${t('Post your land')}</span></a>
      </div>`}`);
  }

  function viewFarmerNew() {
    const u = S.user;
    const first = S.meta.crops[0];
    const min = new Date(Date.parse(S.meta.today) + 86400000).toISOString().slice(0, 10);
    afterRender = () => { updateEstimate($('form[data-form="listing"]')); showPin(); initPicker().then(initPlaceSearch); };
    const hasAI = S.int.gemini || S.int.gemma;
    const canSpeak = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    return page(`
      <p class="crumb"><a href="#/farmer">← ${t('Your land')}</a></p>
      <div class="page-head">
        <div>
          <h1>${t('Post your land')}</h1>
          <p class="muted">${t('Describe your plot and stubble. We will find interested buyers and baling operators.')}</p>
        </div>
      </div>

      ${hasAI ? `<form data-form="assistant" class="panel assistant stack">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="color:var(--leaf-vibrant);">${icon('sparkles', 22)}</span>
          <h2>${t('Describe your land in your own words')}</h2>
        </div>
        <p class="small muted">${t('Speak or type in Hindi, Marwari, Mewari, Punjabi or English. Gemini fills the form for you.')}</p>
        <textarea name="text" rows="3" maxlength="1500" required placeholder="${esc(t('e.g. Mere paas 15 bigha dhan ki parali hai, Sangrur ke Lehra gaon mein, 10 din mein khet khali chahiye'))}"></textarea>
        <div class="actions left">${canSpeak ? `<button type="button" class="btn btn-ghost" data-action="mic">🎙 ${t('Speak')}</button>` : ''}
          <button class="btn btn-farmer" type="submit">${icon('sparkles', 16)} <span>${t('Fill the form')}</span></button></div>
        <div id="assistant-reply" aria-live="polite"></div>
      </form>` : ''}

      <form data-form="listing" class="panel stack">
        <h3>${icon('wheat', 18)} <span>${t('Crop residue')} & ${t('Land')}</span></h3>
        <div class="two">
          ${select('Crop residue', 'crop', cropOptions(), first.key, { req: true, live: 'estimate' })}
          ${field('Land area (acres)', 'acres', { type: 'number', attrs: 'min="0.5" max="5000" step="0.5"', live: 'estimate' })}
        </div>
        <p class="estimate" id="estimate" aria-live="polite"></p>
        <div>
          <button type="button" class="btn btn-ghost btn-sm" data-action="estimate">${icon('leaf', 14)} <span>${t('See the impact')}</span></button>
          <div id="impact" aria-live="polite"></div>
        </div>

        ${S.meta.maps_key ? `<div id="place-search" class="place-search"></div>` : ''}
        <div class="two">
          ${select('State', 'state', stateOptions(), u.state, { req: true })}
          ${field('District', 'district', { value: u.district, attrs: 'maxlength="60"' })}
        </div>
        <div class="two">
          ${field('Village', 'village', { req: false, attrs: 'maxlength="80"' })}
          ${field('Clear the land by', 'clear_by', { type: 'date', attrs: `min="${min}"` })}
        </div>
        <div class="two">
          ${field('Your asking price per acre (₹)', 'ask_price_per_acre', { type: 'number', req: false, value: 0, attrs: 'min="0" max="100000" step="1"', hint: 'Leave 0 if you are happy to give it away.' })}
          ${field('Estimated tonnes', 'est_tonnes', { type: 'number', req: false, attrs: 'min="0.1" step="0.1"' })}
        </div>
        ${textarea('Exact location (shared only after a deal is sealed)', 'address', { max: 300, rows: 2 })}

        ${hasAI ? `<fieldset class="docscan">
          <legend>${icon('shield', 15)} ${t('Scan your land record')}</legend>
          <p class="small muted">${t('Take a photo of your Jamabandi, Khatauni or Fard. Gemini reads the owner, Khasra number and area. Buyers see a "land record checked" mark. The photo itself is not stored.')}</p>
          <input type="file" id="doc-file" accept="image/*" capture="environment" hidden>
          <p><button type="button" class="btn btn-ghost btn-sm" data-action="doc-pick">📄 ${t('Choose photo')}</button></p>
          <div id="doc-result" aria-live="polite"></div>
          <input type="hidden" name="doc_id">
        </fieldset>` : ''}

        <fieldset class="locate">
          <legend>${icon('mapPin', 15)} ${t('Field location on the map')}</legend>
          <p class="small muted">${t('Only the buyer and operator on a sealed deal see the exact pin. Before that, others see your village only.')}</p>
          <div class="locate-tools">
            <button type="button" class="btn btn-ghost btn-sm" data-action="locate-me">${t('Use my current location')}</button>
            ${S.meta.maps_key ? `<button type="button" class="btn btn-ghost btn-sm" data-action="find-village">${t('Find my village on the map')}</button>` : ''}
          </div>
          ${S.meta.maps_key
            ? `<div id="pin-map" class="map map-pick" role="application" aria-label="${esc(t('Field on the map'))}"></div>
               <p class="small muted">${t('Tap the map to drop the pin on your field. Drag the pin to adjust it.')}</p>`
            : `${field('Or paste coordinates or a Google Maps link', 'pin_paste', { req: false, placeholder: '30.6514, 75.6011', live: 'pin-paste', attrs: 'autocomplete="off"', hint: 'In Google Maps, press and hold on your field, then copy the numbers that appear.' })}
               <div id="pin-preview"></div>`}
          <p id="pin-status" class="pin-status" aria-live="polite"></p>
          <input type="hidden" name="lat"><input type="hidden" name="lng">
        </fieldset>

        ${textarea('Notes for buyers and operators', 'notes', { max: 500 })}
        ${errBox}
        <div class="actions">
          <a class="btn btn-ghost" href="#/farmer">${t('Not now')}</a>
          <button class="btn btn-farmer" type="submit">${icon('check', 16)} <span>${t('Save listing')}</span></button>
        </div>
      </form>`, 'narrow');
  }

  function updateEstimate(form) {
    const el = $('#estimate', document);
    if (!el) return;
    const crop = S.meta.crops.find((c) => c.key === form.crop.value);
    const acres = Number(form.acres.value);
    el.textContent = crop && acres > 0 ? `${t('Estimated residue')}: ${fmtNum(acres * crop.tpa)} ${t('tonnes')}` : '';
  }

  /* ───────────── buyer / industry experience ───────────── */
  async function viewBuyerFind() {
    afterRender = loadMarket;
    const { prefs } = await api('/me');
    S.prefs = prefs;
    const topStates = ['Punjab', 'Haryana', 'Uttar Pradesh', 'Rajasthan', 'Madhya Pradesh', 'Delhi'];
    const ordered = [...topStates, ...S.meta.states.filter((s) => !topStates.includes(s))];
    return page(`
      <div class="page-head">
        <div>
          <h1>${t('Find land')}</h1>
          <p class="muted">${t('Browse available crop residue plots, compare proximity, and open requirements for operator reverse bidding.')}</p>
        </div>
      </div>
      <div class="find">
        <aside class="prefs panel">
          <h2>${icon('sliders', 16)} <span>${t('Your preferences')}</span></h2>
          <form data-form="prefs" class="stack">
            <fieldset><legend>${t('Regions you buy from')}</legend>
              <p class="small muted">${t('Leave empty to use your own state.')}</p>
              <div class="checks scroll">${ordered.map((s) => `<label><input type="checkbox" name="states" value="${esc(s)}" ${prefs.states.includes(s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div></fieldset>
            <fieldset><legend>${t('Crops you want')}</legend>
              <div class="checks">${S.meta.crops.map((c) => `<label><input type="checkbox" name="crops" value="${c.key}" ${prefs.crops.includes(c.key) ? 'checked' : ''}> ${esc(t(c.label))}</label>`).join('')}</div></fieldset>
            ${field('Smallest plot (acres)', 'min_acres', { type: 'number', req: false, value: prefs.min_acres || '', attrs: 'min="0" max="5000" step="0.5"' })}
            ${field('Most you will pay the farmer per acre (₹)', 'max_ask_price', { type: 'number', req: false, value: prefs.max_ask_price ?? '', attrs: 'min="0" max="100000" step="1"' })}
            ${errBox}
            <button class="btn btn-buyer" type="submit">${icon('check', 16)} <span>${t('Save preferences')}</span></button>
          </form>
        </aside>
        <section class="results-col">
          <form class="filters" data-form="filters">
            <input type="search" name="q" data-live="filters" value="${esc(S.filters.q)}" placeholder="${esc(t('Search district or village'))}" aria-label="${esc(t('Search district or village'))}">
            <select name="state" data-live="filters" aria-label="${t('State')}">${stateOptions('All states').map(([v, l]) => `<option value="${esc(v)}" ${v === S.filters.state ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
            <select name="crop" data-live="filters" aria-label="${t('Crop residue')}">${cropOptions('All crops').map(([v, l]) => `<option value="${esc(v)}" ${v === S.filters.crop ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
            <select name="sort" data-live="filters" aria-label="${t('Sort by')}">${[['match', 'Best match'], ['deadline', 'Soonest deadline'], ['acres', 'Largest area'], ['price', 'Lowest price'], ...(S.user.base_lat != null ? [['distance', 'Nearest to my plant']] : [])].map(([v, l]) => `<option value="${v}" ${v === S.filters.sort ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>
          </form>
          ${S.meta.maps_key ? `<div class="viewtoggle" role="group"><button class="btn-seg" data-action="market-view" data-v="list">${t('List')}</button><button class="btn-seg" data-action="market-view" data-v="map">${t('Map')}</button></div>` : ''}
          <div id="results">${loading()}</div>
        </section>
      </div>`, 'wide');
  }

  async function loadMarket() {
    const box = $('#results');
    if (!box) return;
    const qs = new URLSearchParams(Object.entries(S.filters).filter(([, v]) => v)).toString();
    try {
      const { items } = await api('/market/listings' + (qs ? '?' + qs : ''));
      if (!$('#results')) return;
      document.querySelectorAll('[data-action="market-view"]').forEach((b) => b.classList.toggle('on', b.dataset.v === (S.marketView || 'list')));
      if (S.marketView === 'map' && S.meta.maps_key) { box.innerHTML = `<div id="market-map" class="map market-map"></div><div id="map-picked"></div>`; drawMarketMap(items); return; }
      box.innerHTML = items.length ? items.map((l) => `
        <article class="land">
          <div class="match" style="--m:${l.match}%"><b>${l.match}%</b><span>${t('match')}</span><i></i></div>
          <div class="land-main">
            <h3>${fmtNum(l.acres)} ${t('acres of')} ${cropLabel(l.crop)}</h3>
            <p class="muted">${icon('mapPin', 14)} ${place(l)}</p>
            <dl class="facts">
              <div><dt>${t('Clear by')}</dt><dd>${fmtDate(l.clear_by)} <span class="due ${urgencyClass(l.days_left)}">${daysText(l.days_left)}</span></dd></div>
              <div><dt>${t('Farmer asks')}</dt><dd>${l.ask_price_per_acre ? `${inr(l.ask_price_per_acre)} ${t('per acre')}` : t('Free to take away')}</dd></div>
              <div><dt>${t('tonnes (estimate)')}</dt><dd>${fmtNum(l.est_tonnes)}</dd></div>
            </dl>
            <p class="chips">${l.reasons.map((r) => `<span class="chip">${t({ state: 'In your region', near_plant: 'Near your plant', crop: 'Crop you want', size: 'Big enough', price: 'Within your price' }[r])}</span>`).join('')}
              ${l.over_budget ? `<span class="chip chip-warn">${t('Over your price limit')}</span>` : ''}
              ${l.distance_km ? `<span class="chip">~${l.distance_km} ${t('km from your plant')}</span>` : ''}${trustChips(l)}</p>
            ${l.notes ? `<p class="small muted" style="margin-top:0.4rem;">${esc(l.notes)}</p>` : ''}
            <p class="small" style="margin-top:0.35rem;"><button class="link" data-action="toggle-map" data-q="${esc(areaQuery(l))}" aria-expanded="false">${icon('mapPin', 13)} ${t('Show area on map')}</button></p>
            <div class="map-slot" hidden></div>
          </div>
          <button class="btn btn-buyer" data-action="pick-land" data-id="${l.id}" data-clear="${l.clear_by}" data-acres="${l.acres}">${icon('check', 15)} <span>${t('Pick this land')}</span></button>
        </article>`).join('')
        : `<div class="empty">
            <div style="font-size:2.5rem;margin-bottom:0.5rem;">🔍</div>
            <h2>${t('No land matches these filters.')}</h2>
            <p>${t('Try another state or crop, or lower the smallest plot size.')}</p>
          </div>`;
    } catch (e) { box.innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
  }

  async function drawMarketMap(items) {
    const box = $('#market-map');
    try {
      await loadGoogleMaps();
      const [{ Map, InfoWindow }, { Marker }] = await Promise.all([gmLib('maps'), gmLib('marker')]);
      if (!document.body.contains(box)) return;
      const map = new Map(box, { center: { lat: 29.5, lng: 76.5 }, zoom: 6, streetViewControl: false, mapTypeControl: false, clickableIcons: false });
      const bounds = new google.maps.LatLngBounds();
      const info = new InfoWindow();
      const groups = {};
      for (const l of items) if (l.approx_lat != null) (groups[`${l.approx_lat},${l.approx_lng}`] ||= []).push(l);
      for (const [key, list] of Object.entries(groups)) {
        const [lat, lng] = key.split(',').map(Number);
        const acres = list.reduce((a, l) => a + l.acres, 0);
        const m = new Marker({ map, position: { lat, lng }, label: { text: String(list.length), color: '#fff', fontWeight: '700' }, title: `${fmtNum(acres)} ${t('acres')}` });
        bounds.extend({ lat, lng });
        m.addListener('click', () => {
          info.setContent(`<div class="iw">${list.map((l) => `<p><b>${fmtNum(l.acres)} ${t('acres of')} ${cropLabel(l.crop)}</b><br>${place(l)}<br>
            <button class="btn btn-buyer btn-sm" data-action="pick-land" data-id="${l.id}" data-clear="${l.clear_by}" data-acres="${l.acres}">${t('Pick this land')}</button></p>`).join('')}</div>`);
          info.open({ map, anchor: m });
        });
      }
      if (S.user.base_lat != null) {
        const k = { lat: S.user.base_lat, lng: S.user.base_lng };
        new Marker({ map, position: k, title: t('Your kiln'), label: { text: 'K', color: '#fff', fontWeight: '800' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: '#A8412C', fillOpacity: 1, strokeColor: '#17262B', strokeWeight: 2 } });
        bounds.extend(k);
      }
      if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
    } catch (e) { if (box) box.outerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
  }

  function pickLandModal(id, clearBy, acres) {
    const min = new Date(Date.parse(S.meta.today) + 86400000).toISOString().slice(0, 10);
    openModal(`<h2 id="modal-title" class="modal-title">${t('Pick this land')}: ${fmtNum(acres)} ${t('acres of')}</h2>
      <p class="muted">${t('The farmer needs the land clear by')} <b>${fmtDate(clearBy)}</b>.</p>
      <form data-form="claim" data-id="${id}" class="stack">
        ${field('Your budget for clearing it (₹)', 'budget_total', { type: 'number', attrs: 'min="1000" max="100000000" step="1"' })}
        <p class="small price-hint" id="price-hint"></p>
        ${field('You need it cleared by', 'needed_by', { type: 'date', attrs: `min="${min}" max="${clearBy}"`, value: clearBy })}
        ${textarea('Notes for operators', 'notes', { max: 500, rows: 2 })}
        ${errBox}
        <div class="actions"><button type="button" class="btn btn-ghost" data-action="close-modal">${t('Not now')}</button>
          <button class="btn btn-buyer" type="submit">${icon('trophy', 16)} <span>${t('Open for bids')}</span></button></div>
      </form>`);
    priceHint(id, null, 'Suggested budget', true);
  }

  async function priceHint(listingId, days, label, usable) {
    try {
      const p = await api('/ai/price', { method: 'POST', body: { listing_id: Number(listingId), days } });
      const el = $('#price-hint');
      if (!el) return;
      el.innerHTML = `${icon('sparkles', 14)} ${t(label)}: <b>${inr(p.low)} – ${inr(p.high)}</b> <span class="muted">(${esc(p.source)})</span>
        ${usable ? ` <button type="button" class="link" data-action="use-budget" data-v="${p.high}">${t('Use')} ${inr(p.high)}</button>` : ''}`;
    } catch { /* optional hint */ }
  }

  async function viewBuyerJobs() {
    const { items } = await api('/requirements/mine');
    const rows = items.map((r) => {
      const saving = r.lowest_bid ? r.budget_total - r.lowest_bid : 0;
      return `<article class="row">
        <div class="row-main">
          <h3>${fmtNum(r.acres)} ${t('acres of')} ${cropLabel(r.crop)}</h3>
          <p class="muted">${icon('mapPin', 14)} ${place(r)}</p>
        </div>
        <div class="row-meta">
          <span>${t('Budget')} <b>${inr(r.budget_total)}</b></span>
          <span>${t('Needed by')} ${fmtDate(r.needed_by)}</span>
        </div>
        <div class="row-status">
          ${pill(r.status, REQ_STATUS[r.status])}
          <p>${r.status === 'open' ? (r.bid_count ? `${r.bid_count} ${t(r.bid_count === 1 ? 'bid' : 'bids')}, ${t('lowest')} <b>${inr(r.lowest_bid)}</b>${saving > 0 ? ` <span class="chip chip-ok" style="font-size:0.75rem;">${inr(saving)} saved</span>` : ''}` : t('no bids yet')) : r.deal_id ? t(DEAL_STATUS[r.deal_status]) : ''}</p>
        </div>
        <div class="row-actions">
          ${r.deal_id ? `<a class="btn btn-primary btn-sm" href="#/deal/${r.deal_id}">${t('Open the deal')}</a>` : ''}
          ${r.status === 'open' ? `<a class="btn btn-buyer btn-sm" href="#/requirement/${r.id}">${icon('trophy', 14)} <span>${t('Review bids')}</span></a>` : ''}
        </div>
      </article>`;
    }).join('');
    return page(`
      <div class="page-head">
        <div>
          <h1>${t('My jobs')}</h1>
          <p class="muted">${t('Active procurement requirements and reverse bidding boards.')}</p>
        </div>
        <div class="actions"><a class="btn btn-ghost" href="#/buyer/auctions">${icon('trophy', 16)} <span>${t('Auctions')}</span></a>
        <a class="btn btn-buyer" href="#/buyer/find">${icon('search', 16)} <span>${t('Find land')}</span></a></div>
      </div>
      ${rows ? `<div class="rows">${rows}</div>` : `<div class="empty">
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">🏭</div>
        <h2>${t('You have no jobs yet.')}</h2>
        <p>${t('Pick land on the Find land page to open it for operator bids.')}</p>
        <a class="btn btn-buyer" href="#/buyer/find">${t('Find land')}</a>
      </div>`}`);
  }

  /* ───────────── transport & operator experience ───────────── */
  async function viewOperatorJobs() {
    afterRender = loadJobs;
    const me = await api('/me');
    const st = me.stats;
    const u = me.user;
    return page(`
      <!-- OPERATOR PROFILE BANNER -->
      <div class="hello-band hello-operator">
        <div>
          <span class="pill pill-claimed" style="margin-bottom: 0.5rem;">🚜 ${t('Transport Portal')}</span>
          <h1>${esc(u.company || u.name)}</h1>
          <p class="hello-sub">${icon('mapPin', 14)} ${esc(u.district)}, ${esc(u.state)} • ${icon('star', 14)} ${st.rating_count ? `${st.rating} / 5 (${st.rating_count} reviews)` : t('No ratings yet')}</p>
        </div>
        <div style="display:flex;gap:1.5rem;align-items:center;">
          <div style="text-align:right;">
            <span class="small hello-k">${t('Fleet Equipment')}</span>
            <b class="hello-v">${esc(u.equipment || 'Tractor & Baler')}</b>
          </div>
          <div class="hello-split">
            <span class="small hello-k">${t('Jobs Completed')}</span>
            <b class="hello-big">${st.jobs_done || 0}</b>
          </div>
        </div>
      </div>

      <div class="page-head">
        <div>
          <h2>${t('Open jobs')}</h2>
          <p class="muted">${t('Browse open land clearing requests from brick kilns and biomass plants.')}</p>
        </div>
      </div>
      <form class="filters" data-form="jobfilters">
        <select name="state" data-live="jobfilters" aria-label="${t('State')}">${stateOptions('All states').map(([v, l]) => `<option value="${esc(v)}" ${v === S.jobFilters.state ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <select name="crop" data-live="jobfilters" aria-label="${t('Crop residue')}">${cropOptions('All crops').map(([v, l]) => `<option value="${esc(v)}" ${v === S.jobFilters.crop ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <select name="sort" data-live="jobfilters" aria-label="${t('Sort by')}">${[['', 'In my state first'], ['deadline', 'Closest deadline'], ['budget', 'Biggest budget'], ['acres', 'Largest area'], ['newest', 'Newest']].map(([v, l]) => `<option value="${v}" ${v === S.jobFilters.sort ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>
      </form>
      <div id="results">${loading()}</div>`, 'wide');
  }

  async function loadJobs() {
    const box = $('#results');
    if (!box) return;
    const qs = new URLSearchParams(Object.entries(S.jobFilters).filter(([, v]) => v)).toString();
    try {
      const { items } = await api('/operator/jobs' + (qs ? '?' + qs : ''));
      if (!$('#results')) return;
      box.innerHTML = items.length ? items.map((j) => {
        const mine = j.my_status === 'active';
        return `<article class="land job">
          <div class="land-main">
            <h3>${fmtNum(j.acres)} ${t('acres of')} ${cropLabel(j.crop)}</h3>
            <p class="muted">${icon('mapPin', 14)} ${place(j)}. <b>${esc(j.buyer_company)}</b></p>
            <dl class="facts">
              <div><dt>${t('Budget')}</dt><dd>${inr(j.budget_total)}</dd></div>
              <div><dt>${t('Needed by')}</dt><dd>${fmtDate(j.needed_by)} <span class="due ${urgencyClass(j.days_left)}">${daysText(j.days_left)}</span></dd></div>
              <div><dt>${t('Lowest bid')}</dt><dd>${j.lowest_bid ? `<b style="color:var(--straw-deep);">${inr(j.lowest_bid)}</b>` : t('no bids yet')}${j.bid_count ? ` <span class="muted">(${j.bid_count} ${t(j.bid_count === 1 ? 'bid' : 'bids')})</span>` : ''}</dd></div>
              <div><dt>${t('tonnes (estimate)')}</dt><dd>${fmtNum(j.est_tonnes)}</dd></div>
            </dl>
            ${mine ? `<p class="chips"><span class="chip chip-ok">✓ ${t('Your bid')}: ${inr(j.my_price)}, ${j.my_days} ${t('days')}</span></p>` : ''}
          </div>
          <a class="btn btn-operator" href="#/requirement/${j.req_id}">${icon('trophy', 15)} <span>${mine ? t('Improve bid') : t('Bid now')}</span></a>
        </article>`;
      }).join('') : `<div class="empty">
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">🚜</div>
        <h2>${t('No open jobs match.')}</h2>
        <p>${t('Try another state, or check back soon. New jobs are posted daily.')}</p>
      </div>`;
    } catch (e) { box.innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
  }

  async function viewOperatorBids() {
    const { items } = await api('/operator/bids');
    const rows = items.map((b) => {
      let key = b.status, text = { active: 'Active', accepted: 'Won', rejected: 'Lost', withdrawn: 'Closed' }[b.status];
      return `<article class="row">
        <div class="row-main">
          <h3>${fmtNum(b.acres)} ${t('acres of')} ${cropLabel(b.crop)}</h3>
          <p class="muted">${icon('mapPin', 14)} ${esc(b.district)}, ${esc(b.state)}</p>
        </div>
        <div class="row-meta">
          <span>${t('Your bid')}: <b>${inr(b.price_total)}</b>, ${b.days} ${t('days')}</span>
          <span>${t('Budget')} ${inr(b.budget_total)}</span>
        </div>
        <div class="row-status">
          ${pill(key, text)}
          <p>${b.status === 'active' && b.req_status === 'open' ? `${t('Your rank')} <b style="color:var(--straw-deep);">${b.rank}</b> ${t('of')} ${b.bid_count}. ${t('Lowest bid')} ${inr(b.lowest_bid)}` : ''}</p>
        </div>
        <div class="row-actions">${b.deal_id ? `<a class="btn btn-primary btn-sm" href="#/deal/${b.deal_id}">${t('Open the deal')}</a>`
          : b.status === 'active' && b.req_status === 'open' ? `<a class="btn btn-operator btn-sm" href="#/requirement/${b.requirement_id}">${t('Improve bid')}</a>` : ''}</div>
      </article>`;
    }).join('');
    return page(`
      <div class="page-head">
        <div>
          <h1>${t('My bids')}</h1>
          <p class="muted">${t('Track your competitive reverse auction bids across active and completed jobs.')}</p>
        </div>
        <a class="btn btn-operator" href="#/operator/jobs">${icon('search', 16)} <span>${t('Open jobs')}</span></a>
      </div>
      ${rows ? `<div class="rows">${rows}</div>` : `<div class="empty">
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">🏷️</div>
        <h2>${t('You have not bid on any job yet.')}</h2>
        <p>${t('Open jobs are on the Open jobs page.')}</p>
        <a class="btn btn-operator" href="#/operator/jobs">${t('Open jobs')}</a>
      </div>`}`);
  }

  /* ───────────── reverse bidding room (requirement view) ───────────── */
  async function viewRequirement(id) {
    const d = await api('/requirements/' + id);
    const { requirement: r, listing: l } = d;
    const back = { buyer: '#/buyer/jobs', operator: '#/operator/jobs', farmer: '#/farmer' }[d.view];
    afterRender = () => {
      if (r.status === 'open') watchBoard(r.id);
      if (d.view === 'operator' && r.status === 'open') priceHint(l.id, null, 'Typical price for this job', false);
    };

    const summary = `
      <div class="panel job-head">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.4rem;">
          <span class="pill ${r.status === 'open' ? 'pill-open' : 'pill-completed'}">${pill(r.status, REQ_STATUS[r.status])}</span>
          ${r.status === 'open' ? `<span class="live-dot">${t('Live')}</span>` : ''}
        </div>
        <h1>${fmtNum(l.acres)} ${t('acres of')} ${cropLabel(l.crop)}</h1>
        <p class="muted">${icon('mapPin', 14)} ${place(l)}</p>
        <dl class="facts big">
          <div><dt>${t('Budget')}</dt><dd>${inr(r.budget_total)}</dd></div>
          <div><dt>${t('Needed by')}</dt><dd>${fmtDate(r.needed_by)} <span class="due ${urgencyClass(r.days_left)}">${daysText(r.days_left)}</span></dd></div>
          <div><dt>${t('Lowest bid')}</dt><dd>${r.lowest_bid ? `<span style="color:var(--straw-deep);">${inr(r.lowest_bid)}</span>` : t('no bids yet')}</dd></div>
          <div><dt>${t('tonnes (estimate)')}</dt><dd>${fmtNum(l.est_tonnes)}</dd></div>
        </dl>
        <p class="small muted">${t('The buyer')}: <b>${esc(r.buyer_company)}</b>.</p>
        ${trustChips(l) ? `<p class="chips">${trustChips(l)}</p>` : ''}
        ${r.notes ? `<p style="margin-top:0.6rem;">${esc(r.notes)}</p>` : ''}${l.notes ? `<p class="muted small">${esc(l.notes)}</p>` : ''}
        ${mapFrame(areaQuery(l), { zoom: 11, title: t('Map') })}
        <p class="small muted map-note">${t('Village area only. The exact field is shared once the deal is sealed.')}
          <a href="${esc(gmapsSearch(areaQuery(l)))}" target="_blank" rel="noopener">${t('Open in Google Maps')}</a></p>
        ${r.deal_id ? `<p style="margin-top:0.75rem;"><a class="btn btn-primary btn-sm" href="#/deal/${r.deal_id}">${t('Open the deal')}</a></p>` : ''}
      </div>`;

    let side = '';
    if (d.view === 'buyer') {
      const fastest = Math.min(...d.bids.map((b) => b.days));
      side = `<section class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <h2>${icon('trophy', 18)} <span>${t('Bids, lowest first')}</span></h2>
          <span class="small muted">${d.bids.length} ${t(d.bids.length === 1 ? 'bid' : 'bids')}</span>
        </div>
        ${d.history?.series?.length ? `<div class="drop-wrap"><h3>${t('How the price fell')}</h3>${dropChart(d.history.series, r.budget_total)}</div>` : ''}
        ${d.bids.length ? d.bids.map((b, i) => `
        <article class="bid ${i === 0 ? 'best' : ''} ${b.status === 'accepted' ? 'won' : ''}">
          <div class="bid-who">
            <h3>${i === 0 ? '🏆 ' : ''}${esc(b.company || b.operator_name)}</h3>
            <p>${stars(b.rating, b.rating_count)}${b.jobs_done ? `, ${jobsDone(b.jobs_done)}` : ''} ${tick(b.phone_verified, 'Verified mobile')}</p>
            <p class="small muted">${esc(b.equipment || '')}</p>${b.note ? `<p class="small">${esc(b.note)}</p>` : ''}
          </div>
          <div class="bid-num">
            <b>${inr(b.price_total)}</b>
            <span>${b.days} ${t('days')}</span>
            <p class="chips">${i === 0 ? `<span class="chip chip-ok">★ ${t('Lowest price')}</span>` : ''}${b.days === fastest ? `<span class="chip">${t('Fastest')}</span>` : ''}</p>
          </div>
          <div class="bid-act">
            ${r.status === 'open' ? (b.meets_deadline
              ? `<button class="btn btn-buyer" data-action="award" data-req="${r.id}" data-bid="${b.id}">${icon('check', 14)} <span>${t('Accept this bid')}</span></button>`
              : `<p class="small chip-warn">${t('Too slow for your deadline now')}</p>`) : ''}
          </div>
        </article>`).join('') : `<div class="empty"><p>${t('No bids yet. Operators in this state have been told about the job.')}</p></div>`}
        ${r.status === 'open' ? `<p style="margin-top:1.2rem;"><button class="btn btn-ghost btn-sm" data-action="cancel-job" data-id="${r.id}">${t('Withdraw this job')}</button></p>` : ''}
      </section>`;
    } else if (d.view === 'operator') {
      const mb = d.my_bid;
      const active = mb && mb.status === 'active';
      const maxDays = Math.max(1, Math.min(180, r.days_left));
      side = `<section class="panel bidbox">
        ${mb && mb.status === 'accepted' ? `<div class="panel" style="background:#e8f5e9;border-color:#a5d6a7;"><h2 style="color:#1b5e20;">🎉 ${t('You won this job.')}</h2></div>`
          : mb && mb.status === 'rejected' && r.status !== 'open' ? `<h2>${t('This job went to another operator.')}</h2>` : ''}
        ${r.status === 'open' ? `
          <h2>${active ? t('Improve your bid') : t('Place your bid')}</h2>
          ${active ? `<div class="yourbid">
            <span>${t('Your bid')}: </span> <b>${inr(mb.price_total)}</b>, ${mb.days} ${t('days')}. 
            <span style="margin-left:0.5rem;">${t('Your rank')}: <b style="color:var(--straw-deep);">${mb.rank}</b> ${t('of')} ${r.bid_count}.</span>
          </div>` : ''}
          <p class="muted small">${r.lowest_bid ? `${t('The current lowest bid is')} <b style="color:var(--straw-deep);">${inr(r.lowest_bid)}</b>. ` : ''}${t('Competitors stay anonymous.')} ${active ? t('A revised bid must be lower, or the same price in fewer days.') : ''}</p>
          <p class="small price-hint" id="price-hint"></p>
          <form data-form="bid" data-id="${r.id}" class="stack">
            <div class="two">
              ${field('Your total price (₹)', 'price_total', { type: 'number', attrs: `min="1" max="${active ? mb.price_total : r.budget_total}" step="1"`, hint: `${t('Budget')}: ${inr(r.budget_total)}` })}
              ${field('Days you need', 'days', { type: 'number', attrs: `min="1" max="${maxDays}" step="1"`, value: active ? mb.days : '', hint: `≤ ${maxDays} ${t('days')}` })}
            </div>
            ${textarea('Note to the buyer', 'note', { max: 400, rows: 2, value: active ? mb.note : '' })}
            ${errBox}
            <div class="actions">
              ${active ? `<button type="button" class="btn btn-ghost" data-action="withdraw-bid" data-req="${r.id}">${t('Withdraw bid')}</button>` : ''}
              <button class="btn btn-operator" type="submit">${icon('trophy', 16)} <span>${active ? t('Send improved bid') : t('Send bid')}</span></button>
            </div>
          </form>` : ''}
      </section>`;
    } else {
      side = `<section class="panel"><p>${r.bid_count} ${t(r.bid_count === 1 ? 'bid' : 'bids')}${r.lowest_bid ? `, ${t('lowest')} <b>${inr(r.lowest_bid)}</b>` : ''}.</p></section>`;
    }
    return page(`<p class="crumb"><a href="${back}">← ${t('Back')}</a></p><div class="req-grid">${summary}${side}</div>`, 'wide');
  }

  /* ───────────── deals ───────────── */
  function parties(d, role) {
    const op = d.operator_company || d.operator_name;
    if (role === 'farmer') return `${d.buyer_company}, ${op}`;
    if (role === 'buyer') return `${d.farmer_name}, ${op}`;
    return `${d.farmer_name}, ${d.buyer_company}`;
  }

  async function viewDeals() {
    const { items } = await api('/deals');
    const role = S.user.role;
    const rows = items.map((d) => `
      <article class="row">
        <div class="row-main">
          <h3>${fmtNum(d.acres)} ${t('acres of')} ${cropLabel(d.crop)}</h3>
          <p class="muted">${icon('mapPin', 14)} ${esc(d.district)}, ${esc(d.state)}</p>
        </div>
        <div class="row-meta">
          <span>${t('Price')} <b>${inr(d.price_total)}</b></span>
          <span>${t('Due')} ${fmtDate(d.due_date)}</span>
        </div>
        <div class="row-status">
          ${pill(d.status, DEAL_STATUS[d.status])}
          <p class="muted small">${esc(parties(d, role))}</p>
        </div>
        <div class="row-actions">${d.status !== 'cancelled' ? `<a class="btn btn-ghost btn-sm" href="#/track/${d.id}">${icon('truck', 14)} <span>${t('Track')}</span></a>` : ''}<a class="btn btn-primary btn-sm" href="#/deal/${d.id}">${t('Open')}</a></div>
      </article>`).join('');
    return page(`
      <div class="page-head">
        <div>
          <h1>${t('Deals')}</h1>
          <p class="muted">${t('Sealed agreements with routes, proof photos and satellite zero-burn checks.')}</p>
        </div>
      </div>
      ${rows ? `<div class="rows">${rows}</div>` : `<div class="empty">
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">🤝</div>
        <h2>${t('No deals yet.')}</h2>
        <p>${t('Sealed deals show up here with contact details for all three sides.')}</p>
      </div>`}`);
  }

  const VERDICT = { looks_right: ['chip-ok', 'Looks like a cleared field or bales'], smoke_or_fire: ['chip-warn', 'Smoke or fire in the photo'], unclear: ['', 'Not clear what this shows'] };
  function photosBlock(d) {
    const can = ['in_progress', 'awaiting_confirmation', 'completed'].includes(d.deal.status);
    if (!can && !d.photos.length) return '';
    return `<h2 style="margin-top:1.5rem;">${icon('camera', 18)} <span>${t('Proof photos')}</span></h2>
      <div class="photos">${d.photos.map((p) => `<figure><img data-photo="${p.id}" alt="${esc(t('Proof photos'))}" width="160" height="120">
        <figcaption>${p.check ? `<span class="chip ${VERDICT[p.check.verdict]?.[0] || ''}">${t(VERDICT[p.check.verdict]?.[1] || 'Not clear what this shows')}</span>
          <span class="small muted">${esc(p.check.labels.slice(0, 4).map((x) => x.name).join(', '))} (${esc(p.check.source)})</span>` : ''}</figcaption></figure>`).join('')}</div>
      ${can ? `<input type="file" id="photo-file" accept="image/*" capture="environment" data-deal="${d.deal.id}" hidden>
        <p style="margin-top:0.75rem;"><button class="btn btn-ghost btn-sm" data-action="photo-pick">📷 ${t('Add a photo')}</button> <span id="photo-status" class="small muted"></span></p>` : ''}`;
  }
  function burnBlock(d) {
    const b = d.burn_check;
    const can = (S.int.earth_engine || S.int.firms) && d.listing.lat != null && d.deal.status !== 'cancelled';
    if (!b && !can) return '';
    let res = '';
    if (b) res = b.zero_burn
      ? `<p>${tick(true, 'Zero-burn check')} ${t('No fire was seen at this field from')} ${fmtDate(b.from)} ${t('to')} ${fmtDate(b.to)}. <span class="small muted">(${esc(b.source)})</span></p>`
      : `<p class="chip-warn">${t('Fire was seen near this field on')} ${b.fire_days.map(fmtDate).join(', ')}. <span class="small">(${esc(b.source)})</span></p>`;
    return `<div class="burn">${res}${can ? `<button class="btn btn-ghost btn-sm" data-action="burn-check" data-id="${d.deal.id}">${icon('satellite', 14)} <span>${t('Zero-burn check')}</span></button>` : ''}</div>`;
  }
  async function loadRoute(id) {
    const box = $('#route-box');
    try {
      const r = await api(`/deals/${id}/route`);
      if (!box || !document.body.contains(box)) return;
      if (!r.ready || r.missing) { box.innerHTML = `<p class="small muted">${t('Add your kiln or machine yard on your Profile to see road distances.')}</p>`; return; }
      const legRow = (label, g) => g ? `<div><dt>${t(label)}</dt><dd>${fmtNum(g.km)} km <span class="muted small">~${Math.round(g.minutes / 6) / 10} h</span></dd></div>` : '';
      const src = Object.values(r.legs)[0]?.source;
      box.innerHTML = `<h2 style="margin-top:1.2rem;">${icon('truck', 18)} <span>${t('Route')}</span></h2><dl class="facts">${legRow('Machine yard to field', r.legs.yard_to_field)}${legRow('Field to kiln', r.legs.field_to_kiln)}
        ${r.haul_cost ? `<div><dt>${t('Hauling cost, roughly')}</dt><dd>${inr(r.haul_cost)}</dd></div>` : ''}</dl><p class="small muted">${esc(src || '')}</p>`;
    } catch { /* optional */ }
  }

  async function viewDeal(id) {
    const d = await api('/deals/' + id);
    afterRender = () => { loadRoute(id); showPhotos(id); };
    const { deal, listing: l, farmer, buyer, operator, my_role: role } = d;
    const steps = [
      ['Deal sealed on', deal.sealed_at], ['Work started', deal.started_at],
      ['Work marked done', deal.work_done_at], ['Farmer confirmed', deal.completed_at],
    ];
    const done = steps.filter(([, ts]) => ts).length;
    let actions = '';
    const funded = d.payment?.escrow?.status === 'held';
    if (role === 'operator' && deal.status === 'sealed') actions += funded
      ? `<button class="btn btn-operator" data-action="deal" data-do="start" data-id="${deal.id}">${t('Start work')}</button>`
      : `<button class="btn btn-operator" disabled title="${esc(t('Waiting for the buyer to pay into escrow. Work starts after that.'))}">${t('Start work')}</button>`;
    if (deal.status !== 'cancelled') actions += `<a class="btn btn-ghost" href="#/track/${deal.id}">${icon('truck', 15)} <span>${t('Track order')}</span></a>`;
    if (role === 'operator' && deal.status === 'in_progress') actions += `<button class="btn btn-operator" data-action="deal" data-do="complete" data-id="${deal.id}">${t('Mark work done')}</button>`;
    if (role === 'farmer' && deal.status === 'awaiting_confirmation') actions += `<button class="btn btn-farmer" data-action="deal" data-do="confirm" data-id="${deal.id}">${t('Confirm the land is clear')}</button>`;
    if (deal.status === 'sealed') actions += `<button class="btn btn-ghost" data-action="deal" data-do="cancel" data-id="${deal.id}">${t('Cancel deal')}</button>`;
    const person = (label, p, me) => `<article class="person ${me ? 'me' : ''}">
      <h3>${t(label)}${me ? ` <span class="chip">${t('You')}</span>` : ''}</h3>
      <p><b>${esc(p.company || p.name)}</b>${p.company ? `<br>${esc(p.name)}` : ''}</p>
      <p class="muted small">${icon('mapPin', 13)} ${esc(p.district)}, ${esc(p.state)}</p>
      ${p.phone_verified || p.email_verified ? `<p>${tick(p.phone_verified, 'Verified mobile')} ${p.email_verified ? tick(true, 'Email') : ''}</p>` : ''}
      <p style="margin-top:0.6rem;"><a class="btn btn-ghost btn-sm" href="tel:+91${esc(p.phone)}">📞 ${t('Call')} ${esc(p.phone)}</a></p>
      ${p.equipment ? `<p class="small muted" style="margin-top:0.4rem;">${esc(p.equipment)}</p><p>${stars(p.rating, p.rating_count)}</p>` : ''}
    </article>`;

    return page(`
      <p class="crumb"><a href="#/deals">← ${t('Deals')}</a></p>
      <div class="page-head">
        <div>
          <h1>${fmtNum(l.acres)} ${t('acres of')} ${cropLabel(l.crop)}</h1>
          <p class="muted">${icon('mapPin', 14)} ${place(l)}</p>
        </div>
        <div>${pill(deal.status, DEAL_STATUS[deal.status])}</div>
      </div>
      <div class="deal-grid">
        <section class="panel">
          <dl class="facts big">
            <div><dt>${t('Price')}</dt><dd>${inr(deal.price_total)}</dd></div>
            <div><dt>${t('days')}</dt><dd>${deal.days}</dd></div>
            <div><dt>${t('Due')}</dt><dd>${fmtDate(deal.due_date)}</dd></div>
            <div><dt>${t('tonnes (estimate)')}</dt><dd>${fmtNum(l.est_tonnes)}</dd></div>
          </dl>
          ${l.address ? `<p style="margin:0.8rem 0;"><b>${t('Exact location')}</b><br>${esc(l.address)}</p>` : ''}
          ${mapFrame(pinQuery(l), { zoom: l.lat != null ? 17 : 13, satellite: l.lat != null, title: t('Field on the map'), cls: 'map-tall' })}
          <p class="map-actions">
            <a class="btn btn-primary btn-sm" href="${esc(gmapsDirections(pinQuery(l)))}" target="_blank" rel="noopener">${t('Get directions')}</a>
            <a class="btn btn-ghost btn-sm" href="${esc(gmapsSearch(pinQuery(l)))}" target="_blank" rel="noopener">${t('Open in Google Maps')}</a>
          </p>
          ${l.notes ? `<p class="muted">${esc(l.notes)}</p>` : ''}
          ${d.requirement.notes ? `<p class="muted">${esc(d.requirement.notes)}</p>` : ''}
          ${trustChips(l) ? `<p class="chips">${trustChips(l)}</p>` : ''}
          <div id="route-box" class="route-box"></div>
          ${burnBlock(d)}
          <h2 style="margin-top:1.5rem;">${t('Progress')}</h2>
          <ol class="timeline ${deal.status === 'cancelled' ? 'is-cancelled' : ''}">${steps.map(([label, ts], i) => `
            <li class="${ts ? 'done' : i === done ? 'next' : ''}"><span>${t(label)}</span>${ts ? `<time>${fmtDate(ts)}</time>` : ''}</li>`).join('')}</ol>
          ${deal.status === 'cancelled' ? `<p>${pill('cancelled', 'Cancelled')} ${fmtDate(deal.cancelled_at)}</p>` : ''}
          ${actions ? `<div class="actions left">${actions}</div>` : ''}
          ${photosBlock(d)}
        </section>
        <section>
          ${paymentPanel(d)}
          <h2>${t('People on this deal')}</h2>
          <div class="people">
            ${person('Farmer', farmer, role === 'farmer')}
            ${person('Buyer', buyer, role === 'buyer')}
            ${person('Operator', operator, role === 'operator')}
          </div>
          ${d.can_rate ? `<form data-form="rate" data-id="${deal.id}" class="panel stack">
            <h2>${t('Rate the operator')}</h2>
            <div class="starpick" role="radiogroup" aria-label="${t('Stars')}">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="s${n}" name="stars" value="${n}" required><label for="s${n}" title="${n}">★</label>`).join('')}</div>
            ${textarea('Comment (optional)', 'comment', { max: 300, rows: 2 })}${errBox}
            <button class="btn btn-primary" type="submit">${t('Send rating')}</button></form>` : ''}
          ${d.ratings.length ? `<div class="panel"><h2>${t('Ratings')}</h2>${d.ratings.map((x) => `<p><span class="rating"><span aria-hidden="true">★</span> ${x.stars}</span> ${esc(x.comment || '')}</p>`).join('')}</div>` : ''}
        </section>
      </div>`, 'wide');
  }

  /* ───────────── reverse-auction hall (buyer) ───────────── */
  // Stepped line of the lowest live bid after each bid event, under a dashed budget line.
  function dropChart(series, budget, { h = 150, label = '' } = {}) {
    const pts = (series || []).filter((p) => p.low != null);
    if (!pts.length) return `<div class="drop-empty">${t('The price line appears with the first bid.')}</div>`;
    const W = 520, H = h, padL = 8, padR = 74, padT = 16, padB = 18;
    const lows = pts.map((p) => p.low);
    const top = Math.max(budget, ...lows);
    const bottom = Math.min(...lows) * 0.9;
    const x = (i) => padL + (pts.length === 1 ? (W - padL - padR) : (i * (W - padL - padR)) / (pts.length - 1));
    const y = (v) => padT + ((top - v) / (top - bottom || 1)) * (H - padT - padB);
    let d = `M${x(0)},${y(pts[0].low)}`;
    for (let i = 1; i < pts.length; i++) d += ` H${x(i)} V${y(pts[i].low)}`;
    if (pts.length === 1) d += ` H${W - padR}`;
    const endX = pts.length === 1 ? W - padR : x(pts.length - 1);
    const area = `${d} V${H - padB} H${x(0)} Z`;
    const last = pts[pts.length - 1].low;
    const by = y(budget), ly = y(last);
    return `<svg class="drop" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label || `${t('Lowest bid fell to')} ${inr(last)}`)}">
      <path class="drop-area" d="${area}"/>
      <line class="drop-budget" x1="${padL}" x2="${W - padR}" y1="${by}" y2="${by}"/>
      <text class="drop-tag drop-tag-b" x="${W - padR + 6}" y="${by + 4}">${t('Budget')}</text>
      <path class="drop-line" d="${d}"/>
      ${pts.map((p, i) => `<circle class="drop-dot ${p.kind === 'withdrawn' ? 'is-out' : ''}" cx="${x(i)}" cy="${y(p.low)}" r="3.2"/>`).join('')}
      <circle class="drop-now" cx="${endX}" cy="${ly}" r="5.5"/>
      <text class="drop-tag drop-tag-l" x="${W - padR + 6}" y="${Math.min(H - 4, Math.max(by + 18, ly + 4))}">${inr(last)}</text>
    </svg>`;
  }

  async function viewBuyerAuctions() {
    const { items, summary: s } = await api('/buyer/auctions');
    const tab = S.auctionTab || 'live';
    const live = items.filter((a) => a.status === 'open');
    const closed = items.filter((a) => a.status !== 'open');
    const shown = tab === 'live' ? live : closed;
    afterRender = () => { for (const a of live) watchBoard(a.id); };

    const ladder = (a) => a.top.length ? `<ol class="ladder">${a.top.map((b, i) => `
      <li class="${i === 0 ? 'lead' : ''} ${b.status === 'accepted' ? 'won' : ''}">
        <span class="ladder-rank" aria-label="${t('Rank')} ${i + 1}">${i + 1}</span>
        <span class="ladder-who"><b>${esc(b.operator)}</b><small>${stars(b.rating, b.rating_count)}${b.jobs_done ? `, ${jobsDone(b.jobs_done)}` : ''}</small></span>
        <span class="ladder-num"><b>${inr(b.price_total)}</b><small>${b.days} ${t('days')}</small></span>
        ${a.status === 'open' ? (b.meets_deadline
          ? `<button class="btn btn-buyer btn-sm" data-action="award" data-req="${a.id}" data-bid="${b.id}">${t('Accept')}</button>`
          : `<span class="small chip-warn">${t('Too slow')}</span>`)
          : b.status === 'accepted' ? `<span class="chip chip-ok">${t('Won')}</span>` : ''}
      </li>`).join('')}</ol>` : `<p class="muted small ladder-empty">${t('No bids yet. Operators in this state have been told about the job.')}</p>`;

    const card = (a) => `
      <article class="auction ${a.status === 'open' ? 'is-live' : 'is-closed'}">
        <header class="auction-head">
          <div>
            <h2>${fmtNum(a.acres)} ${t('acres of')} ${cropLabel(a.crop)}</h2>
            <p class="muted small">${icon('mapPin', 13)} ${place(a)}</p>
          </div>
          <div class="auction-state">
            ${a.status === 'open' ? `<span class="live-dot">${t('Live')}</span><span class="due ${urgencyClass(a.days_left)}">${daysText(a.days_left)}</span>` : pill(a.status, REQ_STATUS[a.status])}
          </div>
        </header>
        <div class="auction-body">
          <div class="auction-chart">
            <dl class="auction-figs">
              <div><dt>${t('Budget')}</dt><dd>${inr(a.budget_total)}</dd></div>
              <div><dt>${a.deal_price != null ? t('Deal price') : t('Lowest bid')}</dt><dd class="hl">${a.deal_price != null ? inr(a.deal_price) : a.lowest_bid ? inr(a.lowest_bid) : '—'}</dd></div>
              <div><dt>${t('Saved')}</dt><dd>${a.saving > 0 ? inr(a.saving) : '—'}</dd></div>
            </dl>
            ${dropChart(a.history, a.budget_total)}
            <p class="small muted">${a.events} ${t(a.events === 1 ? 'bid move' : 'bid moves')}${a.drop_pct > 0 ? `, ${t('price down')} ${a.drop_pct}% ${t('from the first bid')}` : ''}. ${t('Needed by')} ${fmtDate(a.needed_by)}.</p>
          </div>
          <div class="auction-ladder">
            <h3>${t('Top bids')} <span class="muted small">(${a.bid_count} ${t(a.bid_count === 1 ? 'bid' : 'bids')})</span></h3>
            ${ladder(a)}
          </div>
        </div>
        <footer class="auction-foot">
          ${a.deal_id ? `<a class="btn btn-ghost btn-sm" href="#/track/${a.deal_id}">${icon('truck', 14)} <span>${t('Track order')}</span></a>
            <a class="btn btn-primary btn-sm" href="#/deal/${a.deal_id}">${t('Open the deal')}</a>`
          : a.status === 'open' ? `<a class="btn btn-ghost btn-sm" href="#/requirement/${a.id}">${t('Open auction room')}</a>` : ''}
        </footer>
      </article>`;

    return page(`
      <div class="page-head">
        <div>
          <h1>${t('Reverse auctions')}</h1>
          <p class="muted">${t('Operators bid the price down. Accept the bid that suits you best: lowest price, fastest crew or best rating.')}</p>
        </div>
        <a class="btn btn-buyer" href="#/buyer/find">${icon('search', 16)} <span>${t('Start a new auction')}</span></a>
      </div>
      <dl class="figs-strip">
        <div><dt>${t('Live auctions')}</dt><dd>${s.live}</dd></div>
        <div><dt>${t('Bids in play')}</dt><dd>${s.bids_live}</dd></div>
        <div><dt>${t('Budget in play')}</dt><dd>${inr(s.budget_live)}</dd></div>
        <div><dt>${t('Saved against budget')}</dt><dd class="hl">${inr(s.saving)}</dd></div>
      </dl>
      <div class="seg" role="tablist" aria-label="${t('Auctions')}">
        <button role="tab" aria-selected="${tab === 'live'}" class="${tab === 'live' ? 'on' : ''}" data-action="auction-tab" data-v="live">${t('Live')} (${live.length})</button>
        <button role="tab" aria-selected="${tab === 'closed'}" class="${tab === 'closed' ? 'on' : ''}" data-action="auction-tab" data-v="closed">${t('Closed')} (${closed.length})</button>
      </div>
      ${shown.length ? `<div class="auctions">${shown.map(card).join('')}</div>` : `<div class="empty">
        <h2>${t(tab === 'live' ? 'No live auctions right now.' : 'No closed auctions yet.')}</h2>
        <p>${t('Pick land on the marketplace and name your budget. Operators then bid to clear it.')}</p>
        <a class="btn btn-buyer" href="#/buyer/find">${t('Find land')}</a></div>`}`, 'wide');
  }

  /* ───────────── payments ───────────── */
  const PAY_KIND = { escrow: 'Paid into escrow', payout_operator: 'Payout for baling work', payout_farmer: 'Payment for stubble', refund: 'Escrow refund' };
  const PAY_STATUS = { held: 'Held in escrow', released: 'Released', refunded: 'Refunded', paid: 'Paid' };
  const PAY_METHOD = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', bank_transfer: 'Bank transfer' };
  const orderNo = (id) => 'B2B-' + String(id).padStart(5, '0');

  function breakdownList(b) {
    return `<dl class="bill">
      <div><dt>${t('Operator’s price for baling and hauling')}</dt><dd>${inr(b.operator)}</dd></div>
      ${b.farmer > 0 ? `<div><dt>${t('Farmer’s price for the stubble')}</dt><dd>${inr(b.farmer)}</dd></div>` : ''}
      <div><dt>${t('Platform fee')} (${b.fee_pct}%)</dt><dd>${inr(b.fee)}</dd></div>
      <div class="bill-total"><dt>${t('Total')}</dt><dd>${inr(b.total)}</dd></div>
    </dl>`;
  }

  function payModal(dealId, b) {
    openModal(`<h2 id="modal-title" class="modal-title">${t('Pay into escrow')}</h2>
      <p class="muted small">${t('Order')} ${orderNo(dealId)}. ${t('The money is held safely until the farmer confirms the field is clear, then paid to the operator and the farmer. If the deal is cancelled before work starts, you get it back.')}</p>
      ${breakdownList(b)}
      <form data-form="pay" data-id="${dealId}" class="stack">
        <fieldset class="paymethods">
          <legend>${t('Pay with')}</legend>
          <label><input type="radio" name="method" value="upi" checked> <span>UPI</span></label>
          <label><input type="radio" name="method" value="netbanking"> <span>${t('Net banking')}</span></label>
          <label><input type="radio" name="method" value="card"> <span>${t('Card')}</span></label>
        </fieldset>
        <div data-method="upi">${field('UPI ID', 'upi_id', { placeholder: 'name@okaxis', attrs: 'autocomplete="off" inputmode="email"' })}</div>
        <div data-method="netbanking" hidden>${select('Your bank', 'bank', ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Punjab National Bank', 'Bank of Baroda', 'Axis Bank', 'Other bank'].map((x) => [x, x]), 'State Bank of India')}</div>
        <div data-method="card" hidden>${field('Last 4 digits of the card', 'card_last4', { attrs: 'inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" disabled', hint: 'Demo checkout: the full card number is never asked for.' })}</div>
        ${errBox}
        <p class="small muted">${t('Demo gateway: the payment is recorded, no real money moves.')}</p>
        <div class="actions"><button type="button" class="btn btn-ghost" data-action="close-modal">${t('Not now')}</button>
          <button class="btn btn-buyer" type="submit">${icon('shield', 16)} <span>${t('Pay')} ${inr(b.total)}</span></button></div>
      </form>`);
  }

  function receiptModal(out, dealId) {
    openModal(`<div class="receipt">
      <div class="receipt-mark" aria-hidden="true">${icon('check', 30)}</div>
      <h2 id="modal-title" class="modal-title">${t('Paid into escrow')}</h2>
      <p class="receipt-amt">${inr(out.amount)}</p>
      <dl class="bill">
        <div><dt>${t('Order')}</dt><dd>${orderNo(dealId)}</dd></div>
        <div><dt>${t('Reference')}</dt><dd class="mono-ish">${esc(out.ref)}</dd></div>
        <div><dt>${t('Status')}</dt><dd>${t('Held in escrow')}</dd></div>
      </dl>
      <p class="small muted">${t('The operator has been told they can start work.')}</p>
      <div class="actions"><a class="btn btn-ghost" href="#/payments">${t('All payments')}</a>
        <a class="btn btn-primary" href="#/track/${dealId}">${icon('truck', 16)} <span>${t('Track order')}</span></a></div>
    </div>`);
  }

  function paymentPanel(d) {
    const p = d.payment, e = p.escrow, role = d.my_role, st = d.deal.status;
    let body = '';
    if (!e && st === 'sealed') {
      body = role === 'buyer'
        ? `<p>${t('Pay into escrow so the operator can start. The money is released only after the farmer confirms the field is clear.')}</p>
           <p><button class="btn btn-buyer" data-action="pay" data-id="${d.deal.id}">${icon('shield', 16)} <span>${t('Pay')} ${inr(p.breakdown.total)}</span></button></p>`
        : `<p class="chip-warn">${t('Waiting for the buyer to pay into escrow. Work starts after that.')}</p>`;
    } else if (!e) {
      body = `<p class="muted">${t(st === 'cancelled' ? 'No payment was made on this deal.' : 'No escrow payment on record for this deal.')}</p>`;
    } else {
      body = `<p>${pill(e.status, PAY_STATUS[e.status])} <span class="small muted">${PAY_METHOD[e.method] || ''}, ${t('ref')} ${esc(e.ref)}</span></p>`;
    }
    const share = role === 'operator' ? p.breakdown.operator : role === 'farmer' ? p.breakdown.farmer : null;
    return `<section class="panel pay-panel">
      <h2>${icon('wallet', 18)} <span>${t('Payment')}</span></h2>
      ${body}
      ${role === 'buyer' ? breakdownList(p.breakdown) : share ? `<dl class="bill"><div class="bill-total"><dt>${t('Your share')}</dt><dd>${inr(share)}</dd></div></dl>` : ''}
      ${p.rows.length > 1 ? `<ul class="pay-trail">${p.rows.filter((r) => r.kind !== 'escrow').map((r) => `<li>${t(PAY_KIND[r.kind])}: <b>${inr(r.amount)}</b> <span class="small muted">${fmtDate(r.created_at)}</span></li>`).join('')}</ul>` : ''}
    </section>`;
  }

  async function viewPayments() {
    const { items, summary: s, gateway, fee_pct } = await api('/payments');
    const role = S.user.role;
    const figs = role === 'buyer'
      ? [['Paid into escrow', s.paid_out], ['Held in escrow now', s.in_escrow], ['Refunded', s.refunded], ['Due now', s.due_total]]
      : [['Received', s.received], ['On its way (in escrow)', s.in_escrow]];
    const who = (p) => role === 'buyer' ? p.operator_company : role === 'operator' ? p.buyer_company : p.buyer_company;
    const rows = items.map((p) => `
      <tr>
        <td>${fmtDate(p.created_at)}</td>
        <td><a href="#/track/${p.deal_id}">${orderNo(p.deal_id)}</a><small>${fmtNum(p.acres)} ${t('acres')}, ${esc(p.district)} · ${esc(who(p))}</small></td>
        <td>${t(PAY_KIND[p.kind])}</td>
        <td>${PAY_METHOD[p.method] || '—'}</td>
        <td class="ref">${esc(p.ref)}</td>
        <td class="amt ${p.direction}">${p.direction === 'in' ? '+' : '−'}${inr(p.amount)}</td>
        <td>${pill(p.status, PAY_STATUS[p.status])}</td>
      </tr>`).join('');
    return page(`
      <div class="page-head">
        <div>
          <h1>${t('Payments')}</h1>
          <p class="muted">${t(role === 'buyer' ? 'You pay into escrow once a deal is sealed. It is paid out when the farmer confirms the field is clear.' : 'Money for your deals is held in escrow and paid to your bank when the farmer confirms the field is clear.')}</p>
        </div>
      </div>
      ${gateway === 'demo' ? `<p class="note-demo">${t('Demo gateway: payments are recorded, no real money moves.')} ${t('Platform fee')}: ${fee_pct}%.</p>` : ''}
      <dl class="figs-strip">${figs.map(([k, v], i) => `<div><dt>${t(k)}</dt><dd class="${i === 0 ? 'hl' : ''}">${inr(v)}</dd></div>`).join('')}</dl>
      ${s.due.length ? `<section class="panel due-panel"><h2>${t('Waiting for your payment')}</h2>
        ${s.due.map((x) => `<div class="due-row"><span>${t('Order')} <a href="#/deal/${x.deal_id}">${orderNo(x.deal_id)}</a></span><b>${inr(x.total)}</b>
          <button class="btn btn-buyer btn-sm" data-action="pay" data-id="${x.deal_id}">${t('Pay now')}</button></div>`).join('')}</section>` : ''}
      <h2 class="sec-title">${t('Transactions')}</h2>
      ${rows ? `<div class="table-wrap"><table class="ledger">
        <thead><tr><th>${t('Date')}</th><th>${t('Order')}</th><th>${t('Type')}</th><th>${t('Method')}</th><th>${t('Reference')}</th><th class="amt">${t('Amount')}</th><th>${t('Status')}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : `<div class="empty"><h2>${t('No payments yet.')}</h2>
        <p>${t(role === 'buyer' ? 'Once you seal a deal, pay into escrow from the deal page.' : 'Payments show up here once a buyer pays into escrow for your deal.')}</p></div>`}`, 'wide');
  }

  /* ───────────── order tracking ───────────── */
  const STEP_ICON = { sealed: 'shield', paid: 'wallet', started: 'tractor', baling: 'wheat', in_transit: 'truck', delivered: 'factory', work_done: 'check', confirmed: 'user', released: 'coins' };

  function rail(tr, compact) {
    if (compact) return `<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${tr.pct}"><span style="width:${tr.pct}%"></span></div>`;
    return `<ol class="rail ${tr.deal.status === 'cancelled' ? 'is-cancelled' : ''}">${tr.steps.map((s) => `
      <li class="${s.done ? 'done' : ''} ${s.key === tr.current ? 'now' : ''}">
        <span class="rail-dot" aria-hidden="true">${icon(STEP_ICON[s.key], 15)}</span>
        <span class="rail-label">${t(s.label)}</span>
        ${s.at ? `<time>${fmtWhen(s.at)}</time>` : ''}
      </li>`).join('')}</ol>`;
  }
  const fmtWhen = (ts) => new Date(ts).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const stepLabel = (tr) => {
    if (tr.deal.status === 'cancelled') return t(tr.refunded ? 'Cancelled, payment refunded' : 'Cancelled');
    if (tr.current === 'released' && tr.pct === 100) return t('Delivered and paid');
    const s = tr.steps.find((x) => x.key === tr.current);
    return `${t('Next')}: ${t(s ? s.label : '')}`;
  };

  async function viewTrackList() {
    const { items } = await api('/track');
    const role = S.user.role;
    const rows = items.map((tr) => {
      const d = tr.deal;
      return `<article class="row track-row">
        <div class="row-main">
          <h3>${fmtNum(d.acres)} ${t('acres of')} ${cropLabel(d.crop)} <span class="small muted">${orderNo(d.id)}</span></h3>
          <p class="muted small">${icon('mapPin', 13)} ${esc(d.district)}, ${esc(d.state)} · ${esc(role === 'buyer' ? d.operator_company : role === 'operator' ? d.buyer_company : d.operator_company)}</p>
        </div>
        <div class="track-mid">
          ${rail(tr, true)}
          <p class="small"><b>${tr.pct}%</b> · ${esc(stepLabel(tr))}</p>
        </div>
        <div class="row-meta">
          <span>${t('Due')} ${fmtDate(d.due_date)}</span>
          ${['completed', 'cancelled'].includes(d.status) ? '' : `<span class="due ${urgencyClass(d.days_left)}">${daysText(d.days_left)}</span>`}
        </div>
        <div class="row-actions"><a class="btn btn-primary btn-sm" href="#/track/${d.id}">${icon('truck', 14)} <span>${t('Track')}</span></a></div>
      </article>`;
    }).join('');
    return page(`
      <div class="page-head"><div>
        <h1>${t('Track orders')}</h1>
        <p class="muted">${t('Every sealed deal, from payment to bales at the kiln.')}</p>
      </div></div>
      ${rows ? `<div class="rows">${rows}</div>` : `<div class="empty"><h2>${t('No orders to track yet.')}</h2>
        <p>${t('Orders appear here once a deal is sealed.')}</p></div>`}`);
  }

  async function viewTrack(id) {
    const tr = await api(`/deals/${id}/track`);
    const d = tr.deal, role = tr.my_role;
    const canPost = role === 'operator' && ['in_progress', 'awaiting_confirmation'].includes(d.status);
    const acresPct = Math.min(100, Math.round((tr.acres_done / d.acres) * 100));
    const e = tr.payment.escrow;
    let callout = '';
    if (d.status === 'sealed' && !e) callout = role === 'buyer'
      ? `<div class="callout"><p>${t('Pay into escrow so the operator can start.')}</p><button class="btn btn-buyer" data-action="pay" data-id="${d.id}">${icon('shield', 16)} <span>${t('Pay')} ${inr(tr.payment.breakdown.total)}</span></button></div>`
      : `<div class="callout"><p>${t('Waiting for the buyer to pay into escrow. Work starts after that.')}</p></div>`;
    else if (role === 'operator' && d.status === 'sealed') callout = `<div class="callout"><p>${t('The buyer has paid. You can start work.')}</p><button class="btn btn-operator" data-action="deal" data-do="start" data-id="${d.id}">${t('Start work')}</button></div>`;
    else if (role === 'farmer' && d.status === 'awaiting_confirmation') callout = `<div class="callout"><p>${t('The operator says the work is done. Check the field and confirm.')}</p><button class="btn btn-farmer" data-action="deal" data-do="confirm" data-id="${d.id}">${t('Confirm the land is clear')}</button></div>`;

    const stageOpts = Object.entries(tr.stages).map(([k, v]) => [k, t(v)]);
    return page(`
      <p class="crumb"><a href="#/track">← ${t('Track orders')}</a></p>
      <div class="page-head">
        <div>
          <p class="small muted order-no">${t('Order')} ${orderNo(d.id)}</p>
          <h1>${fmtNum(d.acres)} ${t('acres of')} ${cropLabel(d.crop)}</h1>
          <p class="muted">${icon('mapPin', 14)} ${place(d)}</p>
        </div>
        <div class="track-headline">
          <b>${tr.pct}%</b>
          <span>${esc(stepLabel(tr))}</span>
        </div>
      </div>
      ${rail(tr)}
      ${callout}
      <div class="track-grid">
        <section>
          <div class="panel">
            <h2>${t('Field progress')}</h2>
            <p class="acres-line"><b>${fmtNum(tr.acres_done)}</b> ${t('of')} ${fmtNum(d.acres)} ${t('acres cleared')}</p>
            <div class="meter meter-field" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${acresPct}"><span style="width:${acresPct}%"></span></div>
            <p class="small muted">~${fmtNum(d.est_tonnes)} ${t('tonnes of stubble')} ${t('going to')} ${esc(d.buyer_company)}.</p>
          </div>
          ${canPost ? `<form class="panel stack" data-form="track-update" data-id="${d.id}">
            <h2>${t('Post an update')}</h2>
            <div class="two">
              ${select('What is happening now', 'stage', stageOpts, tr.updates.length ? tr.updates[tr.updates.length - 1].stage : 'baling', { req: true })}
              ${field('Acres cleared so far', 'acres_done', { type: 'number', req: false, attrs: `min="0" max="${d.acres}" step="0.5"`, value: tr.acres_done || '' })}
            </div>
            ${textarea('Note for the buyer and farmer', 'note', { max: 300, rows: 2, placeholder: 'e.g. 2 trolleys left for the kiln at 4 pm' })}
            ${errBox}
            <div class="actions left"><button class="btn btn-operator" type="submit">${icon('truck', 16)} <span>${t('Send update')}</span></button>
            ${d.status === 'in_progress' ? `<button type="button" class="btn btn-ghost" data-action="deal" data-do="complete" data-id="${d.id}">${t('Mark work done')}</button>` : ''}</div>
          </form>` : ''}
          <div class="panel">
            <h2>${t('Updates from the field')}</h2>
            ${tr.updates.length ? `<ol class="feed">${tr.updates.slice().reverse().map((u) => `
              <li><time>${fmtWhen(u.created_at)}</time>
                <p><b>${t(u.label)}</b>${u.acres_done != null ? ` <span class="chip">${fmtNum(u.acres_done)} ${t('acres')}</span>` : ''}</p>
                ${u.note ? `<p class="muted">${esc(u.note)}</p>` : ''}</li>`).join('')}</ol>`
              : `<p class="muted">${t(d.status === 'sealed' ? 'Updates start once the crew is on the field.' : 'No updates yet.')}</p>`}
          </div>
        </section>
        <aside>
          <div class="panel">
            <h2>${t('Order details')}</h2>
            <dl class="bill">
              <div><dt>${t('Price')}</dt><dd>${inr(d.price_total)}</dd></div>
              <div><dt>${t('Due')}</dt><dd>${fmtDate(d.due_date)}</dd></div>
              <div><dt>${t('Buyer')}</dt><dd>${esc(d.buyer_company)}</dd></div>
              <div><dt>${t('Operator')}</dt><dd>${esc(d.operator_company)}</dd></div>
              <div><dt>${t('Farmer')}</dt><dd>${esc(d.farmer_name)}</dd></div>
            </dl>
          </div>
          <div class="panel">
            <h2>${icon('wallet', 18)} <span>${t('Payment')}</span></h2>
            ${e ? `<p>${pill(e.status, PAY_STATUS[e.status])}</p><p class="small muted">${inr(e.amount)}, ${PAY_METHOD[e.method] || ''}, ${t('ref')} ${esc(e.ref)}</p>`
              : `<p class="muted">${t(d.status === 'cancelled' ? 'No payment was made on this deal.' : 'Not paid yet.')}</p>`}
            ${tr.refunded ? `<p class="small">${t('Refunded on')} ${fmtDate(tr.refunded)}.</p>` : ''}
            <p><a href="#/payments">${t('All payments')}</a></p>
          </div>
          <p><a class="btn btn-ghost btn-block" href="#/deal/${d.id}">${t('Open the deal')}</a></p>
        </aside>
      </div>`, 'wide');
  }

  /* ───────────── profile ───────────── */
  function viewProfile() {
    const u = S.user;
    return page(`
      <div class="page-head">
        <div>
          <h1>${t('Profile')}</h1>
          <p class="muted">${esc(u.email)}</p>
        </div>
      </div>
      <form data-form="profile" class="panel stack">
        <h2>${icon('user', 18)} <span>${t('Account details')}</span></h2>
        ${field('Full name', 'name', { value: u.name, attrs: 'maxlength="80"' })}
        ${u.role !== 'farmer' ? field(u.role === 'buyer' ? 'Company name' : 'Business name', 'company', { value: u.company || '', attrs: 'maxlength="100"' }) : ''}
        <div class="two">
          ${select('State', 'state', stateOptions(), u.state)}
          ${field('District', 'district', { value: u.district, attrs: 'maxlength="60"' })}
        </div>
        ${u.role === 'farmer' ? field('Village', 'village', { value: u.village || '', req: false, attrs: 'maxlength="80"' }) : ''}
        ${u.role === 'operator' ? `
          ${textarea('Equipment you have', 'equipment', { value: u.equipment || '', max: 300, rows: 2 })}
          ${field('Acres you can clear per day', 'capacity_acres_per_day', { type: 'number', value: u.capacity_acres_per_day || '', attrs: 'min="1" max="1000" step="1"' })}` : ''}
        ${errBox}
        <div class="actions"><button class="btn btn-primary" type="submit">${t('Save changes')}</button></div>
      </form>

      <section class="panel stack">
        <h2>${icon('shield', 18)} <span>${t('Verification')}</span></h2>
        <ul class="verify-list">
          <li><div><span>${t('Mobile number')}</span><br><b>${esc(u.phone || '—')}</b></div>
            ${u.phone_verified ? tick(true, 'Verified') : u.phone ? `<button class="btn btn-ghost btn-sm" data-action="verify" data-channel="phone">${t('Verify')}</button>` : ''}</li>
          <li><div><span>${t('Email')}</span><br><b>${esc(u.email || '—')}</b></div>
            ${u.email_verified ? tick(true, 'Verified') : `<button class="btn btn-ghost btn-sm" data-action="verify" data-channel="email">${t('Verify')}</button>`}</li>
        </ul>
        <p class="small muted">${t('People on your deals see a tick next to verified details.')}</p>
      </section>

      ${u.role !== 'farmer' ? `
      <form data-form="base" class="panel stack">
        <h2>${icon('mapPin', 18)} <span>${u.role === 'buyer' ? t('Your kiln or plant location') : t('Where your machines are kept')}</span></h2>
        <p class="small muted">${t('Used to show distance to land and the road route on deals.')}</p>
        <div class="two">
          ${field('Latitude', 'base_lat', { value: u.base_lat ?? '', attrs: 'min="-90" max="90" step="0.000001"', placeholder: 'e.g. 29.9695' })}
          ${field('Longitude', 'base_lng', { value: u.base_lng ?? '', attrs: 'min="-180" max="180" step="0.000001"', placeholder: 'e.g. 76.8783' })}
        </div>
        <p class="small"><button type="button" class="btn btn-ghost btn-sm" data-action="base-locate">${t('Use my current location')}</button></p>
        ${field('Or paste a Google Maps link or coordinates', 'base_paste', { req: false, placeholder: '29.9695, 76.8783' })}
        ${errBox}
        <div class="actions"><button class="btn btn-primary" type="submit">${t('Save location')}</button></div>
      </form>` : ''}

      <form data-form="password" class="panel stack">
        <h2>${t('Change password')}</h2>
        ${field('Current password', 'current_password', { type: 'password', attrs: 'autocomplete="current-password"' })}
        ${field('New password', 'new_password', { type: 'password', attrs: 'autocomplete="new-password" minlength="8" maxlength="72"', hint: 'At least 8 characters' })}
        ${errBox}
        <div class="actions"><button class="btn btn-primary" type="submit">${t('Change password')}</button></div>
      </form>`, 'narrow');
  }

  function setBase(lat, lng) {
    const f = $('form[data-form="base"]');
    if (!f) return;
    f.base_lat.value = Number(lat).toFixed(6);
    f.base_lng.value = Number(lng).toFixed(6);
    f.base_paste.value = '';
  }

  /* ───────────── tech (Google services status) ───────────── */
  async function viewTech() {
    const st = await api('/integrations');
    const row = (name, desc, state) => `
      <li class="tech tech-${state}">
        <div><h3>${esc(name)}</h3><p>${esc(desc)}</p></div>
        <span class="tech-state">${t({ on: 'On', fallback: 'Fallback', off: 'Off' }[state])}</span></li>`;
    return page(`
      <div class="page-head">
        <div>
          <h1>${t('Built with Google')}</h1>
          <p class="muted">Where each Google Cloud and Firebase service is used in Bale to Brick.</p>
        </div>
      </div>
      <ul class="techlist stack">
        ${row('Gemini API (AI Studio)', 'Voice / text descriptions of land filled into the form in Hindi, Marwari, Mewari, Punjabi or English; OCR on land records (Jamabandi/Khatauni); impact advice.', st.gemini ? 'on' : st.gemma ? 'fallback' : 'off')}
        ${row('Gemma (open model)', 'Offline fallback for Gemini features, served locally through Ollama.', st.gemma ? 'on' : 'off')}
        ${row('Google Maps Platform', 'Satellite pin picker, Places search for villages, all-land map, satellite view and directions on sealed deals.', st.maps ? 'on' : 'fallback')}
        ${row('Routes API', 'Road distance, drive time and hauling cost from machine yard to field and field to kiln.', st.routes ? 'on' : 'fallback')}
        ${row('Google Earth Engine', 'Sentinel-2 NDVI/NDTI harvest check; NASA FIRMS satellite fire detection for zero-burn verification.', st.earth_engine ? 'on' : st.firms ? 'fallback' : 'off')}
        ${row('Firebase Authentication', 'Phone OTP for farmers and "Continue with Google" for buyers.', st.firebase_auth ? 'on' : 'fallback')}
        ${row('Cloud Firestore', 'Live bid boards and instant notification pings.', st.firestore ? 'on' : 'fallback')}
        ${row('Cloud Vision API', 'Inspects proof photos for cleared fields and bales; flags smoke or fire.', st.vision ? 'on' : st.gemini ? 'fallback' : 'off')}
        ${row('Vertex AI', 'Suggests fair budgets and bids learned from historical job data.', st.vertex ? 'on' : 'fallback')}
        ${row('Cloud Run and Firebase Hosting', 'The app runs in a container on Cloud Run, served at a web.app address with HTTPS.', st.cloud_run ? 'on' : 'off')}
      </ul>
      <p class="small muted" style="margin-top:1.5rem;">On: connected to the Google service. Fallback: the feature works with a simpler built-in method until the key is added. Off: add the key listed in .env.example.</p>`, 'narrow');
  }

  /* ───────────── router ───────────── */
  let afterRender = null;
  let renderId = 0;

  async function render(opts) {
    const my = ++renderId;
    afterRender = null;
    picker = null;
    boardOff?.(); boardOff = null;
    const keepScroll = opts?.keepScroll === true;
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const [a, b] = parts;
    const u = S.user;
    document.documentElement.lang = S.lang === 'hi' ? 'hi' : 'en';

    const needAuth = (...roles) => {
      if (!u) { go('#/login/' + (roles[0] || 'farmer')); return false; }
      if (roles.length && !roles.includes(u.role)) { go(homeFor(u.role)); return false; }
      return true;
    };

    let view;
    try {
      if (!a) view = u ? (go(homeFor(u.role)), null) : viewLanding();
      else if (a === 'how-it-works') {
        view = viewLanding();
        afterRender = () => {
          loadStats();
          setTimeout(() => {
            const el = document.getElementById('how-it-works');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        };
      }
      else if (a === 'about') { go('#/tech'); return; }
      else if (a === 'login') view = u ? (go(homeFor(u.role)), null) : viewLogin(b || 'farmer');
      else if (a === 'register') view = u ? (go(homeFor(u.role)), null) : viewRegister(b || 'farmer');
      else if (a === 'farmer' && b === 'new') view = needAuth('farmer') && viewFarmerNew();
      else if (a === 'farmer') view = needAuth('farmer') && (await viewFarmer());
      else if (a === 'buyer' && b === 'jobs') view = needAuth('buyer') && (await viewBuyerJobs());
      else if (a === 'buyer' && b === 'auctions') view = needAuth('buyer') && (await viewBuyerAuctions());
      else if (a === 'auctions') view = (go('#/buyer/auctions'), null);
      else if (a === 'track' && b) view = needAuth() && (await viewTrack(b));
      else if (a === 'track') view = needAuth() && (await viewTrackList());
      else if (a === 'payments') view = needAuth() && (await viewPayments());
      else if (a === 'buyer') view = needAuth('buyer') && (await viewBuyerFind());
      else if (a === 'operator' && b === 'bids') view = needAuth('operator') && (await viewOperatorBids());
      else if (a === 'operator') view = needAuth('operator') && (await viewOperatorJobs());
      else if (a === 'bids') view = (go('#/operator/bids'), null);
      else if (a === 'requirement' && b) view = needAuth() && (await viewRequirement(b));
      else if (a === 'deals') view = needAuth() && (await viewDeals());
      else if (a === 'deal' && b) view = needAuth() && (await viewDeal(b));
      else if (a === 'profile') view = needAuth() && viewProfile();
      else if (a === 'tech') view = await viewTech();
      else view = page(`<div class="empty"><h1>${t('Page not found')}</h1><p><a class="btn btn-primary" href="${u ? homeFor(u.role) : '#/'}">${t(u ? 'Go to your dashboard' : 'Landing page')}</a></p></div>`);
    } catch (e) {
      if (my !== renderId) return;
      view = page(`<div class="empty"><h1>${esc(e.message)}</h1><p><a class="btn btn-primary" href="${u ? homeFor(u.role) : '#/'}">${t(u ? 'Go to your dashboard' : 'Landing page')}</a></p></div>`);
    }
    if (my !== renderId || !view) return;
    $('#app').innerHTML = view;
    $('#main-nav')?.classList.remove('open');
    vaSync();
    if (!keepScroll) window.scrollTo(0, 0);
    if (afterRender) afterRender();
    if (u) refreshUnread();
  }

  async function refreshUnread() {
    if (!S.token) return;
    try {
      const { unread } = await api('/notifications');
      S.unread = unread;
      const b = $('#badge');
      if (b) { b.textContent = unread; b.hidden = !unread; }
    } catch { /* ignore */ }
  }

  /* ───────────── events ───────────── */
  async function toggleBell() {
    const panel = $('#notif-panel');
    if (!panel) return;
    if (!panel.hidden) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML = loading();
    try {
      const { items } = await api('/notifications');
      panel.innerHTML = items.length ? `<h2 class="sr">${t('Notifications')}</h2><ul>${items.map((n) => `
        <li class="${n.is_read ? '' : 'unread'}">${n.link ? `<a href="${esc(n.link)}">${esc(n.text)}</a>` : esc(n.text)}
          <time>${new Date(n.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></li>`).join('')}</ul>`
        : `<p class="muted pad">${t('Nothing new yet.')}</p>`;
      if (S.unread) { await api('/notifications/read', { method: 'POST' }); S.unread = 0; const b = $('#badge'); if (b) b.hidden = true; }
    } catch (e) { panel.innerHTML = `<p class="form-error pad">${esc(e.message)}</p>`; }
  }

  const actions = {
    lang() { S.lang = S.lang === 'hi' ? 'en' : 'hi'; store.set('b2b_lang', S.lang); render(); },
    bell: toggleBell,
    'va-toggle'() { VA.open = !VA.open; if (!VA.open) { VA.rec?.stop(); window.speechSynthesis?.cancel(); } vaRender(); if (VA.open) $('#va-input')?.focus(); },
    'va-speak'() { VA.speak = !VA.speak; store.set('b2b_va_speak', VA.speak ? '1' : '0'); if (!VA.speak) window.speechSynthesis?.cancel(); vaRender(); },
    'va-mic'() { vaListen(); },
    'va-chip'(el) { vaAsk(el.dataset.q); },
    menu(el) {
      const nav = $('#main-nav'); const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open); el.setAttribute('aria-expanded', String(open)); el.classList.toggle('x', open);
    },
    account(el) {
      const m = $('#acct-menu'); m.hidden = !m.hidden; el.setAttribute('aria-expanded', String(!m.hidden));
    },
    logout() { endSession(); },
    'close-modal': closeModal,
    'fill-demo'(el) {
      const otpForm = $('form[data-form="login-otp"]');
      if (otpForm) { otpForm.who.value = el.dataset.phone; otpForm.who.focus(); return; }
      const f = $('form[data-form="login"]');
      if (!f) { go('#/login/' + (el.dataset.role || 'buyer')); return; }
      f.email.value = el.dataset.email; f.password.value = 'demo1234';
      f.requestSubmit();
    },
    'login-mode'() { resetRecaptcha(); S.loginOtp = !S.loginOtp; render(); },
    'otp-fill'(el) { const i = $('.otp-input', dlg); if (i) { i.value = el.dataset.code; i.focus(); } },
    async 'otp-resend'(el) {
      el.disabled = true;
      const info = await S.otpFlow.resend();
      otpModal(info, S.otpFlow);
      toast(t('New code sent.'));
    },
    async verify(el) {
      const channel = el.dataset.channel;
      const send = () => api('/me/verify/send', { method: 'POST', body: { channel } });
      await startOtp(await send(), {
        title: t('Verify') + ': ' + t(channel === 'email' ? 'Email' : 'Mobile number'),
        resend: send,
        async verifyWith(p) {
          const { user } = await api('/me/verify', { method: 'POST', body: { channel, ...p } });
          S.user = user; closeModal(); toast(t('Verified.')); render();
        },
      });
    },
    async 'google-signin'(el) {
      const fb = await loadFirebase(['auth']);
      let cred;
      try { cred = await fb.auth().signInWithPopup(new fb.auth.GoogleAuthProvider()); } catch (e) {
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
        throw new Error(fbError(e));
      }
      const idToken = await cred.user.getIdToken();
      await fb.auth().signOut();
      const role = el.dataset.role;
      try {
        const d = await api('/auth/google', { method: 'POST', body: { id_token: idToken, role } });
        startSession(d); go(homeFor(d.user.role));
      } catch (e) {
        if (e.status !== 404 || !e.data?.signup) throw e;
        S.googleSignup = { ...e.data.signup, token: idToken };
        toast(t('No account yet. Finish signing up.')); go('#/register/' + role);
      }
    },
    mic(el) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const box = $('form[data-form="assistant"] textarea');
      if (window.__b2bRec) { window.__b2bRec.stop(); return; }
      const rec = new SR();
      rec.lang = S.lang === 'hi' ? 'hi-IN' : 'en-IN';
      rec.interimResults = false; rec.continuous = true;
      const label = el.textContent;
      rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) box.value = (box.value + ' ' + e.results[i][0].transcript).trim(); };
      rec.onend = () => { window.__b2bRec = null; el.textContent = label; el.classList.remove('rec'); };
      rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') toast(e.error === 'not-allowed' ? 'Microphone permission was denied.' : e.error, 'error'); };
      window.__b2bRec = rec; rec.start();
      el.textContent = t('Listening… tap to stop'); el.classList.add('rec');
    },
    'doc-pick'() { $('#doc-file')?.click(); },
    async estimate() {
      const f = $('form[data-form="listing"]');
      const box = $('#impact');
      box.innerHTML = loading();
      try {
        const e = await api('/ai/estimate', { method: 'POST', body: { crop: f.crop.value, acres: f.acres.value, est_tonnes: f.est_tonnes.value || undefined, lang: S.lang } });
        box.innerHTML = impactCard(e);
      } catch (err) { box.innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
    },
    'use-area'(el) { const f = $('form[data-form="listing"]'); f.acres.value = el.dataset.acres; updateEstimate(f); },
    'use-budget'(el) { const f = $('form[data-form="claim"]'); if (f) f.budget_total.value = el.dataset.v; },
    'market-view'(el) { S.marketView = el.dataset.v; loadMarket(); },
    async 'sat-check'(el) {
      el.disabled = true; el.textContent = t('Checking satellite images…');
      try { await api(`/listings/${el.dataset.id}/satellite`, { method: 'POST' }); render({ keepScroll: true }); }
      catch (e) { el.disabled = false; el.textContent = t('Check from space'); throw e; }
    },
    async 'burn-check'(el) {
      el.disabled = true; el.textContent = t('Checking satellite images…');
      try { await api(`/deals/${el.dataset.id}/burn-check`, { method: 'POST' }); render({ keepScroll: true }); }
      catch (e) { el.disabled = false; el.textContent = t('Zero-burn check'); throw e; }
    },
    'photo-pick'() { $('#photo-file')?.click(); },
    async 'base-locate'(el) {
      if (!window.isSecureContext || !navigator.geolocation) return toast(t('Location only works on a secure (https) page.'), 'error');
      el.disabled = true;
      navigator.geolocation.getCurrentPosition((p) => { el.disabled = false; setBase(p.coords.latitude, p.coords.longitude); },
        () => { el.disabled = false; toast(t('Could not get your location. Try again, or place the pin yourself.'), 'error'); }, { enableHighAccuracy: true, timeout: 15000 });
    },
    'locate-me'(el) {
      if (!window.isSecureContext) return toast(t('Location only works on a secure (https) page.'), 'error');
      if (!navigator.geolocation) return toast(t('This browser cannot share your location.'), 'error');
      const label = el.textContent;
      el.disabled = true; el.textContent = t('Finding you…');
      const done = () => { el.disabled = false; el.textContent = label; };
      navigator.geolocation.getCurrentPosition(
        (p) => { done(); if (setPin(p.coords.latitude, p.coords.longitude, { pan: true })) toast(t('Pinned your current location. Check it is on your field.')); },
        (err) => { done(); toast(t(err.code === 1 ? 'Location permission was denied. Allow it in your browser settings, or place the pin yourself.' : 'Could not get your location. Try again, or place the pin yourself.'), 'error'); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    },
    'find-village'() { findArea(false); },
    'clear-pin'() { clearPin(); },
    'toggle-map'(el) {
      const slot = el.closest('.land')?.querySelector('.map-slot');
      if (!slot) return;
      const open = slot.hidden;
      if (open && !slot.innerHTML) slot.innerHTML = mapFrame(el.dataset.q, { zoom: 12 });
      slot.hidden = !open;
      el.setAttribute('aria-expanded', String(open));
      el.textContent = t(open ? 'Hide map' : 'Show area on map');
    },
    'pick-land'(el) { pickLandModal(el.dataset.id, el.dataset.clear, el.dataset.acres); },
    async 'cancel-listing'(el) {
      if (!(await confirmDialog(t('Withdraw this land from the market?'), t('Withdraw'), true))) return;
      await api('/listings/' + el.dataset.id, { method: 'DELETE' }); render();
    },
    async 'cancel-job'(el) {
      if (!(await confirmDialog(t('Withdraw this job? All bids will be closed and the land goes back on the market.'), t('Withdraw this job'), true))) return;
      await api(`/requirements/${el.dataset.id}/cancel`, { method: 'POST' }); go('#/buyer/jobs');
    },
    async award(el) {
      if (!(await confirmDialog(t('Accept this bid and seal the deal? The other operators will be told the job is taken.'), t('Seal the deal')))) return;
      const { deal_id } = await api(`/requirements/${el.dataset.req}/award`, { method: 'POST', body: { bid_id: Number(el.dataset.bid) } });
      toast(t('Deal sealed.')); go('#/deal/' + deal_id);
    },
    'auction-tab'(el) { S.auctionTab = el.dataset.v; render({ keepScroll: true }); },
    async pay(el) {
      const d = await api('/deals/' + el.dataset.id);
      if (d.payment.escrow) { toast(t('This deal is already paid.')); render(); return; }
      payModal(d.deal.id, d.payment.breakdown);
    },
    async 'withdraw-bid'(el) {
      await api(`/requirements/${el.dataset.req}/bids/mine`, { method: 'DELETE' }); toast(t('Bid withdrawn.')); render();
    },
    async deal(el) {
      const msg = { start: null, complete: 'Mark the work as done? The farmer will be asked to confirm.', confirm: 'Confirm that the land is cleared?', cancel: 'Cancel this deal? The land goes back on the market.' }[el.dataset.do];
      if (msg && !(await confirmDialog(t(msg), t(el.dataset.do === 'cancel' ? 'Cancel deal' : 'Confirm'), el.dataset.do === 'cancel'))) return;
      await api(`/deals/${el.dataset.id}/advance`, { method: 'POST', body: { action: el.dataset.do } }); toast(t('Done.')); render();
    },
  };

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (el) {
      e.preventDefault();
      try { await actions[el.dataset.action]?.(el); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    if (!e.target.closest('.bell-wrap')) { const p = $('#notif-panel'); if (p) p.hidden = true; }
    if (!e.target.closest('.acct-wrap')) { const m = $('#acct-menu'); if (m) m.hidden = true; }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const id of ['#notif-panel', '#acct-menu']) { const p = $(id); if (p) p.hidden = true; }
    $('#main-nav')?.classList.remove('open');
  });

  const submitters = {
    async login(f) {
      resetRecaptcha();
      const email = (f.email?.value || '').trim();
      const password = f.password?.value || '';
      const data = await api('/auth/login', { method: 'POST', body: { email, password, role: f.dataset.role } });
      startSession(data);
      go(homeFor(data.user.role));
    },
    async register(f) {
      const body = { ...formObj(f), role: f.dataset.role };
      if (S.googleSignup) Object.assign(body, { otp_channel: 'email', firebase_id_token: S.googleSignup.token, email: S.googleSignup.email });
      const send = () => api('/auth/register', { method: 'POST', body });
      const data = await send();
      if (!data.otp_required) { S.googleSignup = null; resetRecaptcha(); startSession(data); go(homeFor(data.user.role)); return; }
      await startOtp(data, {
        title: t('Verify your account'),
        resend: send,
        async verifyWith(p) {
          const d = await api('/auth/register', { method: 'POST', body: { ...body, otp_code: p.code, firebase_id_token: p.firebase_id_token } });
          closeModal();
          resetRecaptcha();
          startSession(d);
          toast(t('Account created and verified.'));
          go(homeFor(d.user.role));
        },
      });
    },
    async 'login-otp'(f) {
      const target = (f.who?.value || '').trim();
      const isEmail = target.includes('@');
      const body = { channel: isEmail ? 'email' : 'phone', target, role: f.dataset.role };
      const send = () => api('/auth/otp/send', { method: 'POST', body });
      await startOtp(await send(), {
        title: t('Enter your code'),
        resend: send,
        async verifyWith(p) {
          const d = await api('/auth/login/otp', { method: 'POST', body: { ...body, ...p } });
          closeModal();
          resetRecaptcha();
          startSession(d);
          go(homeFor(d.user.role));
        },
      });
    },
    async otp(f) {
      await S.otpFlow.verifyWith({ code: f.code.value.trim() });
    },
    async base(f) {
      const { user } = await api('/me', { method: 'PUT', body: { base_lat: f.base_lat.value, base_lng: f.base_lng.value } });
      S.user = user; toast(t('Location saved.')); render();
    },
    async assistant(f) {
      const out = await api('/ai/parse-listing', { method: 'POST', body: { text: f.text.value } });
      const lf = $('form[data-form="listing"]');
      for (const k of ['crop', 'acres', 'village', 'district', 'state', 'clear_by', 'ask_price_per_acre', 'notes']) {
        if (out[k] != null && lf[k]) { lf[k].value = out[k]; lf[k].classList.add('ai-filled'); }
      }
      updateEstimate(lf); showPin(); findArea(true);
      $('#assistant-reply').innerHTML = `<p>${esc(out.reply)}</p><p class="small muted">${t('Form filled. Check each field before saving.')} (${esc(out.engine)})</p>`;
    },
    async listing(f) {
      const body = formObj(f);
      delete body.pin_paste;
      if (!body.doc_id) delete body.doc_id;
      await api('/listings', { method: 'POST', body }); toast(t('Land posted. Buyers can see it now.')); go('#/farmer');
    },
    async prefs(f) {
      const fd = new FormData(f);
      await api('/buyer/prefs', { method: 'PUT', body: { states: fd.getAll('states'), crops: fd.getAll('crops'), min_acres: fd.get('min_acres'), max_ask_price: fd.get('max_ask_price') } });
      toast(t('Preferences saved.')); loadMarket();
    },
    async claim(f) {
      const { id } = await api('/requirements', { method: 'POST', body: { ...formObj(f), listing_id: Number(f.dataset.id) } });
      closeModal(); toast(t('The job is open. Operators can bid now.')); go('#/requirement/' + id);
    },
    async bid(f) {
      const out = await api(`/requirements/${f.dataset.id}/bids`, { method: 'POST', body: formObj(f) });
      toast(t(out.revised ? 'Bid improved.' : 'Bid sent.')); render();
    },
    async va(f) { const q = f.q.value; f.q.value = ''; await vaAsk(q); },
    async pay(f) {
      const out = await api(`/deals/${f.dataset.id}/pay`, { method: 'POST', body: formObj(f) });
      receiptModal(out, f.dataset.id);
      render({ keepScroll: true });
    },
    async 'track-update'(f) {
      await api(`/deals/${f.dataset.id}/updates`, { method: 'POST', body: formObj(f) });
      toast(t('Update sent to the buyer and the farmer.')); render({ keepScroll: true });
    },
    async rate(f) {
      await api(`/deals/${f.dataset.id}/rate`, { method: 'POST', body: formObj(f) }); toast(t('Thank you. Your rating is saved.')); render();
    },
    async profile(f) {
      const { user } = await api('/me', { method: 'PUT', body: formObj(f) }); S.user = user; toast(t('Saved.')); render();
    },
    async password(f) {
      await api('/me/password', { method: 'PUT', body: formObj(f) }); f.reset(); toast(t('Password changed.'));
    },
  };

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    if (!submitters[f.dataset.form]) return;
    const btn = $('[type="submit"]', f);
    const err = $('.form-error', f); if (err) err.textContent = '';
    if (btn) btn.disabled = true;
    try { await submitters[f.dataset.form](f); } catch (x) { showErr(f, x); } finally { if (btn) btn.disabled = false; }
  });

  let debounce;
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-live]');
    if (!el) return;
    const kind = el.dataset.live;
    if (kind === 'estimate') return updateEstimate(el.form);
    if (kind === 'landing-calc') return updateLandingCalc();
    if (kind === 'pin-paste') {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const v = el.value.trim();
        if (!v) return clearPin();
        const c = parseCoords(v);
        if (c) setPin(c[0], c[1], { fromPaste: true });
        else $('#pin-status').innerHTML = `<span class="form-error">${t('Could not read coordinates from that. Try numbers like 30.6514, 75.6011.')}</span>`;
      }, 400);
      return;
    }
    if (kind === 'filters' && el.tagName === 'INPUT') {
      clearTimeout(debounce);
      debounce = setTimeout(() => { S.filters.q = el.value.trim(); loadMarket(); }, 300);
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-live]');
    if (!el) return;
    if (el.dataset.live === 'landing-calc') return updateLandingCalc();
    if (el.dataset.live === 'filters' && el.tagName === 'SELECT') { S.filters[el.name] = el.value; loadMarket(); }
    if (el.dataset.live === 'jobfilters') { S.jobFilters[el.name] = el.value; loadJobs(); }
    if (el.dataset.live === 'estimate') updateEstimate(el.form);
  });
  document.addEventListener('change', (e) => {
    const f = e.target.form;
    if (f?.dataset.form !== 'pay' || e.target.name !== 'method') return;
    for (const g of f.querySelectorAll('[data-method]')) {
      const on = g.dataset.method === e.target.value;
      g.hidden = !on;
      for (const i of g.querySelectorAll('input, select')) i.disabled = !on;
    }
  });
  document.addEventListener('change', async (e) => {
    const inp = e.target;
    if (inp.id === 'doc-file' && inp.files[0]) {
      const box = $('#doc-result');
      box.innerHTML = `<p class="muted">${t('Reading the document…')}</p>`;
      try {
        const d = await api('/ai/read-document', { method: 'POST', body: await photoPayload(inp.files[0], 2000) });
        $('form[data-form="listing"]').doc_id.value = d.id;
        box.innerHTML = docCard(d, true);
      } catch (err) { box.innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
      inp.value = '';
    }
    if (inp.id === 'photo-file' && inp.files[0]) {
      const st = $('#photo-status');
      st.textContent = t('Uploading and checking…');
      try {
        await api(`/deals/${inp.dataset.deal}/photos`, { method: 'POST', body: await photoPayload(inp.files[0]) });
        toast(t('Photo added.')); render({ keepScroll: true });
      } catch (err) { st.innerHTML = `<span class="form-error">${esc(err.message)}</span>`; }
      inp.value = '';
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.name !== 'base_paste') return;
    const c = parseCoords(e.target.value);
    if (c) setBase(c[0], c[1]);
  });
  document.addEventListener('change', (e) => {
    const f = e.target.form;
    if (f?.dataset.form === 'listing' && ['village', 'district', 'state'].includes(e.target.name)) showPin();
  });

  /* ───────────── "Ask Bale to Brick": AI voice assistant ───────────── */
  const SRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const VA = { open: false, listening: false, busy: false, speak: store.get('b2b_va_speak') !== '0', msgs: [], rec: null, key: '' };
  const vaRoot = () => $('#assistant-root');
  const vaChips = () => {
    const r = S.user?.role;
    const en = {
      buyer: ['What is my lowest bid?', 'Do I have payments due?', 'Track my order', 'Open auctions'],
      operator: ['What is my rank?', 'Show open jobs', 'How much money is in escrow?', 'Track my order'],
      farmer: ['Where is my order?', 'How much have I received?', 'Post my land', 'How does it work?'],
    }[r] || ['How does it work?', 'What is the platform fee?', 'How is payment kept safe?', 'Why not burn stubble?'];
    const hi = {
      buyer: ['मेरी सबसे कम बोली क्या है?', 'कोई भुगतान बाकी है?', 'मेरा ऑर्डर कहाँ है?', 'नीलामी खोलो'],
      operator: ['मेरी रैंक क्या है?', 'खुले काम दिखाओ', 'एस्क्रो में कितना पैसा है?', 'मेरा ऑर्डर कहाँ है?'],
      farmer: ['मेरा ऑर्डर कहाँ है?', 'मुझे कितना पैसा मिला?', 'मेरी ज़मीन दर्ज करो', 'यह कैसे काम करता है?'],
    }[r] || ['यह कैसे काम करता है?', 'प्लेटफ़ॉर्म शुल्क कितना है?', 'भुगतान सुरक्षित कैसे है?', 'पराली क्यों न जलाएँ?'];
    return S.lang === 'hi' ? hi : en;
  };

  function vaRender() {
    const root = vaRoot();
    if (!root) return;
    VA.key = `${S.user?.id || 0}|${S.lang}`;
    const msgs = VA.msgs.length ? VA.msgs : [{ from: 'bot', text: t(S.user ? 'Hi! Ask me about your auctions, bids, orders or payments. Tap the mic and speak in Hindi or English.' : 'Hi! I can explain how Bale to Brick works. Tap the mic and speak in Hindi or English.') }];
    root.innerHTML = `
      <button class="va-fab ${VA.open ? 'is-open' : ''}" data-action="va-toggle" aria-expanded="${VA.open}" aria-controls="va-panel" aria-label="${t('Ask Bale to Brick')}">
        ${VA.open ? '<span class="va-x" aria-hidden="true">×</span>' : `<img src="img/logo-96.png" alt="" width="34" height="34"><span class="va-fab-label">${t('Ask AI')}</span>`}
      </button>
      <section class="va-panel" id="va-panel" ${VA.open ? '' : 'hidden'} aria-label="${t('Ask Bale to Brick')}">
        <header class="va-head">
          <img src="img/logo-96.png" alt="" width="36" height="36">
          <div><b>${t('Ask Bale to Brick')}</b><small>${t('Voice assistant')} · ${S.lang === 'hi' ? 'हिन्दी' : 'English'}</small></div>
          <button class="va-icon" data-action="va-speak" aria-pressed="${VA.speak}" title="${t(VA.speak ? 'Mute spoken replies' : 'Speak replies aloud')}">${VA.speak ? '🔊' : '🔇'}</button>
        </header>
        <div class="va-log" id="va-log" aria-live="polite">
          ${msgs.map((m) => `<div class="va-msg va-${m.from}"><p>${esc(m.text)}</p>${m.navigate ? `<a class="va-go" href="${esc(m.navigate)}">${t('Open page')} ›</a>` : ''}${m.engine ? `<small>${esc(m.engine)}</small>` : ''}</div>`).join('')}
          ${VA.busy ? `<div class="va-msg va-bot va-typing"><span></span><span></span><span></span></div>` : ''}
        </div>
        <div class="va-chips">${vaChips().map((c) => `<button data-action="va-chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <form class="va-form" data-form="va">
          <button type="button" class="va-mic ${VA.listening ? 'on' : ''}" data-action="va-mic" ${SRec ? '' : 'disabled title="' + esc(t('Voice input needs Chrome or Edge. You can type instead.')) + '"'} aria-label="${t(VA.listening ? 'Stop listening' : 'Speak')}">
            ${VA.listening ? '<span class="va-wave"><i></i><i></i><i></i><i></i></span>' : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/></svg>`}
          </button>
          <input name="q" id="va-input" autocomplete="off" maxlength="500" placeholder="${esc(t(VA.listening ? 'Listening…' : 'Ask by voice or type here'))}" aria-label="${t('Your question')}">
          <button class="va-send" type="submit" aria-label="${t('Send')}">${icon('arrowRight', 18)}</button>
        </form>
      </section>`;
    const log = $('#va-log'); if (log) log.scrollTop = log.scrollHeight;
  }
  function vaSync() { if (VA.key !== `${S.user?.id || 0}|${S.lang}`) { if (VA.key) VA.msgs = []; vaRender(); } }

  function vaSay(text) {
    if (!VA.speak || !window.speechSynthesis) return;
    const lang = S.lang === 'hi' || /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
    const spoken = text.replace(/₹\s?([\d,]+)/g, (_, n) => (lang === 'hi-IN' ? `${n} रुपये` : `${n} rupees`));
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = lang; u.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => x.lang === lang) || speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  async function vaAsk(text) {
    text = String(text || '').trim();
    if (!text || VA.busy) return;
    VA.msgs.push({ from: 'me', text });
    VA.busy = true; vaRender();
    try {
      const out = await api('/assistant', { method: 'POST', body: { text, lang: S.lang, history: VA.msgs.slice(-7, -1) } });
      VA.msgs.push({ from: 'bot', text: out.reply, navigate: out.navigate, engine: out.engine });
      VA.busy = false; vaRender(); vaSay(out.reply);
      if (out.navigate && out.navigate !== location.hash) setTimeout(() => { location.hash = out.navigate; }, 900);
    } catch (e) {
      VA.msgs.push({ from: 'bot', text: e.message });
      VA.busy = false; vaRender();
    }
  }

  function vaListen() {
    if (!SRec) return toast(t('Voice input needs Chrome or Edge. You can type instead.'), 'error');
    if (VA.listening) { VA.rec?.stop(); return; }
    window.speechSynthesis?.cancel();
    const rec = new SRec();
    rec.lang = S.lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
      }
      const inp = $('#va-input'); if (inp) inp.value = (finalText + ' ' + interim).trim();
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast(t('Microphone permission was denied. Allow it in the address bar, or type your question.'), 'error');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast(e.error, 'error');
    };
    rec.onend = () => { VA.listening = false; VA.rec = null; vaRender(); if (finalText.trim()) vaAsk(finalText); };
    VA.rec = rec; VA.listening = true; vaRender();
    try { rec.start(); } catch { VA.listening = false; vaRender(); }
  }

  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img?.tagName === 'IMG' && img.dataset.fallback && !img.dataset.failed) {
      img.dataset.failed = '1';
      img.closest('figure')?.classList.add('img-failed');
    }
  }, true);

  /* ───────────── boot ───────────── */
  async function boot() {
    $('#app').innerHTML = loading();
    try { [S.meta, S.int] = await Promise.all([api('/meta'), api('/integrations')]); } catch { $('#app').innerHTML = '<p class="loading">Could not reach the server. Please refresh.</p>'; return; }
    if (S.token) {
      try { const me = await api('/me'); S.user = me.user; S.unread = me.unread; S.inboxId = me.inbox_id; liveStart(); }
      catch { S.token = null; store.set('b2b_token', null); }
    }
    window.addEventListener('hashchange', () => { if (dlg.open) closeModal(); render(); });
    setInterval(refreshUnread, 60000);
    render();
  }
  boot();
})();
