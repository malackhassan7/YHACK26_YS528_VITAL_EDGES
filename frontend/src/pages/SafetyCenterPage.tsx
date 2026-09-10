import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BatteryCharging,
  Tv,
  Cpu,
  Flame,
  Lightbulb,
  Laptop
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface SafetyGuideline {
  id: string;
  iconName: "battery" | "display" | "pcb" | "fridge" | "lamp" | "computer";
  titleEn: string;
  titleHi: string;
  hazardLevel: "HIGH" | "MEDIUM" | "LOW";
  hazardEn: string;
  hazardHi: string;
  dosEn: string[];
  dosHi: string[];
  dontsEn: string[];
  dontsHi: string[];
  speechTextEn: string;
  speechTextHi: string;
}

const SAFETY_DATA: SafetyGuideline[] = [
  {
    id: "battery",
    iconName: "battery",
    titleEn: "Batteries & Power Cells (Li-ion / Lead Acid)",
    titleHi: "बैटरियां और पावर सेल (लिथियम-आयन / लेड एसिड)",
    hazardLevel: "HIGH",
    hazardEn: "Fire risk, toxic chemical leakage, thermal explosion if punctured.",
    hazardHi: "आग का खतरा, विषैले रसायन का रिसाव और फटने का गंभीर जोखिम।",
    dosEn: [
      "Keep separate from metallic e-waste to avoid short circuits.",
      "Tape terminal contacts with non-conductive electrical tape.",
      "Store in a dry, ventilated, and shaded area away from heat sources.",
    ],
    dosHi: [
      "शॉर्ट सर्किट से बचने के लिए अन्य धातुओं से अलग रखें।",
      "टर्मिनलों पर इन्सुलेटिंग टेप लगाएं।",
      "सूखी, हवादार और धूप से दूर ठंडी जगह पर रखें।",
    ],
    dontsEn: [
      "NEVER puncture, crush, or open battery enclosures.",
      "NEVER throw batteries into open fires or incinerators.",
      "NEVER immerse swollen or leaking batteries in water.",
    ],
    dontsHi: [
      "कभी भी बैटरियों को न तोड़ें, न छेदें और न खोलें।",
      "इन्हें कभी भी खुली आग या भट्टी में न फेंकें।",
      "फूली हुई या रिसती हुई बैटरी को पानी में न डालें।",
    ],
    speechTextEn:
      "Safety guidance for Batteries. High hazard. Keep battery terminals taped and store in a dry, shaded place. Never puncture, crush, or burn batteries. Fire and explosion hazard.",
    speechTextHi:
      "बैटरियों के लिए सुरक्षा निर्देश। अत्यधिक खतरनाक। बैटरियों को हमेशा सूखी जगह पर रखें और टर्मिनल पर टेप लगाएं। इन्हें कभी भी न तोड़ें और न ही आग में जलाएं।",
  },
  {
    id: "display",
    iconName: "display",
    titleEn: "CRT Monitors & Display Panels",
    titleHi: "सीआरटी मॉनिटर और डिस्प्ले स्क्रीन",
    hazardLevel: "MEDIUM",
    hazardEn: "Implosion risk from vacuum glass, toxic leaded phosphor powder.",
    hazardHi: "वैक्यूम ग्लास टूटने का खतरा और विषैला लेड व फॉस्फोर पाउडर।",
    dosEn: [
      "Handle display units by the sturdy outer bezel.",
      "Wear thick protective cut-resistant gloves and safety goggles.",
      "Transport upright to prevent screen glass fractures.",
    ],
    dosHi: [
      "स्क्रीन को हमेशा बाहरी मजबूत फ्रेम से पकड़ें।",
      "मोटे दस्ताने और सुरक्षा चश्मा पहनें।",
      "ग्लास को टूटने से बचाने के लिए सीधा रखकर ले जाएं।",
    ],
    dontsEn: [
      "NEVER break the vacuum neck of CRT tubes manually.",
      "NEVER inhale inner white phosphor dust.",
      "NEVER smash LCD panels to extract backlights.",
    ],
    dontsHi: [
      "सीआरटी ट्यूब को हथौड़े से कभी न तोड़ें।",
      "अंदरूनी फॉस्फोर पाउडर की धूल में सांस न लें।",
      "एलसीडी स्क्रीन को कभी कुचलें नहीं।",
    ],
    speechTextEn:
      "Safety guidance for CRT and Displays. Medium hazard. Wear protective gloves and goggles. Never break the vacuum glass tube or inhale phosphor powder.",
    speechTextHi:
      "डिस्प्ले और मॉनिटर के लिए सुरक्षा निर्देश। हमेशा दस्ताने और चश्मा पहनें। स्क्रीन के कांच को कभी न तोड़ें।",
  },
  {
    id: "pcb",
    iconName: "pcb",
    titleEn: "Printed Circuit Boards (PCBs)",
    titleHi: "सर्किट बोर्ड और पीसीबी (PCBs)",
    hazardLevel: "MEDIUM",
    hazardEn: "Heavy metal exposure (lead, cadmium), sharp fiberglass edges.",
    hazardHi: "भारी धातुओं (लेड, कैडमियम) का संपर्क और नुकीले किनारे।",
    dosEn: [
      "Keep circuit boards intact in dry collection bins.",
      "Wear puncture-resistant gloves when handling sharp boards.",
      "Stack neatly to avoid component shearing.",
    ],
    dosHi: [
      "सर्किट बोर्डों को सूखे बक्से में सुरक्षित रखें।",
      "नुकीले किनारों से बचने के लिए सुरक्षात्मक दस्ताने पहनें।",
      "बोर्ड्स को व्यवस्थित तरीके से रखें।",
    ],
    dontsEn: [
      "NEVER use open-flame burners or acid baths to extract gold at home.",
      "NEVER grind PCBs into airborne dust.",
      "NEVER burn boards to melt solder.",
    ],
    dontsHi: [
      "घर पर सोना निकालने के लिए कभी भी आग या तेजाब का उपयोग न करें।",
      "पीसीबी को कभी पीसें या जलाएं नहीं। यह अत्यधिक जहरीला है।",
      "सोल्डर पिघलाने के लिए खुली आग का प्रयोग न करें।",
    ],
    speechTextEn:
      "Safety guidance for Printed Circuit Boards. Medium hazard. Wear puncture-resistant gloves. Never burn boards or use acid baths at home for metal extraction. Deliver intact to authorized recyclers.",
    speechTextHi:
      "सर्किट बोर्ड के लिए सुरक्षा नियम। दस्ताने पहनें। धातु निकालने के लिए इन्हें कभी न जलाएं और न ही तेजाब का उपयोग करें।",
  },
  {
    id: "fridge",
    iconName: "fridge",
    titleEn: "Refrigerators & Cooling Equipment",
    titleHi: "फ्रिज एवं कूलिंग उपकरण (कंप्रेसर और गैस)",
    hazardLevel: "HIGH",
    hazardEn: "Pressurized refrigerant gases (CFCs / HFCs), flammable oils.",
    hazardHi: "दबाव वाली विषैली गैसें और ज्वलनशील कंप्रेसर तेल।",
    dosEn: [
      "Keep copper gas pipes intact without cutting.",
      "Store upright to prevent compressor oil leakage.",
      "Hand over directly to recyclers equipped with gas evacuation systems.",
    ],
    dosHi: [
      "गैस पाइपों को बिना काटे सुरक्षित रखें।",
      "कंप्रेसर तेल के रिसाव को रोकने के लिए सीधा रखें।",
      "केवल अधिकृत रीसाइक्लर को ही सौंपें।",
    ],
    dontsEn: [
      "NEVER cut or puncture refrigerant copper coils to vent gas.",
      "NEVER drain compressor oils into municipal drains or soil.",
      "NEVER burn polyurethane insulation foam.",
    ],
    dontsHi: [
      "गैस पाइप को कभी न काटें। यह ओजोन परत और स्वास्थ्य को नुकसान पहुंचाती है।",
      "कंप्रेसर के तेल को कभी नाली या जमीन पर न बहाएं।",
      "इंसुलेशन फोम को कभी न जलाएं।",
    ],
    speechTextEn:
      "Safety guidance for Refrigerators and Cooling devices. High hazard. Never puncture copper gas lines or drain compressor oil. Keep coils sealed.",
    speechTextHi:
      "फ्रिज और कूलिंग उपकरणों के लिए सुरक्षा निर्देश। गैस पाइपों को कभी न काटें। कंप्रेसर तेल को सुरक्षित रखें।",
  },
  {
    id: "lamp",
    iconName: "lamp",
    titleEn: "Fluorescent Tubes & Mercury Lamps",
    titleHi: "फ्लोरोसेंट ट्यूबलाइट और मरकरी लैंप",
    hazardLevel: "HIGH",
    hazardEn: "Toxic mercury vapor causes severe neurological and respiratory harm.",
    hazardHi: "जहरीला पारा (मरकरी) वाष्प, जो सांस और नसों के लिए अत्यंत हानिकारक है।",
    dosEn: [
      "Store bulbs in original cardboard sleeves or bubble wrap.",
      "Handle by the metallic base rather than the glass body.",
      "If a bulb breaks, ventilate the room for 15 minutes immediately.",
    ],
    dosHi: [
      "बल्बों को हमेशा गत्ते के डिब्बों में रखें।",
      "कांच के बजाय धातु वाले हिस्से से पकड़ें।",
      "यदि कोई ट्यूब टूट जाए, तो तुरंत 15 मिनट के लिए खिड़कियां खोल दें।",
    ],
    dontsEn: [
      "NEVER break fluorescent tubes to save storage volume.",
      "NEVER sweep broken mercury powder with a regular vacuum cleaner.",
      "NEVER discard mercury lamps in ordinary trash bins.",
    ],
    dontsHi: [
      "जगह बचाने के लिए ट्यूबलाइट को कभी न तोड़ें।",
      "टूटे हुए पारे को साधारण वैक्यूम से न साफ करें।",
      "इन्हें कभी सामान्य कूड़ेदान में न फेंकें।",
    ],
    speechTextEn:
      "Safety guidance for Fluorescent Lamps and Mercury Bulbs. High hazard. Contains toxic mercury vapor. Never break tubes to save storage space. Keep them packed intact.",
    speechTextHi:
      "ट्यूबलाइट और मरकरी लैंप के लिए निर्देश। अत्यधिक खतरनाक। इसमें जहरीला पारा होता है। जगह बचाने के लिए इन्हें कभी न तोड़ें।",
  },
  {
    id: "computer",
    iconName: "computer",
    titleEn: "Computers, Laptops & General Electronics",
    titleHi: "कंप्यूटर, लैपटॉप और सामान्य इलेक्ट्रॉनिक्स",
    hazardLevel: "LOW",
    hazardEn: "Heavy lifting strain, internal capacitor residual electric charge.",
    hazardHi: "भारी वजन उठाने से चोट और बिजली का अवशिष्ट झटका।",
    dosEn: [
      "Disconnect from power mains and discharge capacitors before handling.",
      "Lift with your knees and keep heavy loads close to your body.",
      "Keep all detached cables neatly coiled and bundled.",
    ],
    dosHi: [
      "काम शुरू करने से पहले बिजली का प्लग निकाल लें।",
      "भारी वजन उठाते समय घुटनों के बल झुकें।",
      "सभी केबलों को लपेटकर रखें।",
    ],
    dontsEn: [
      "NEVER touch internal power supply capacitors with bare hands.",
      "NEVER burn plastic casings to salvage internal copper.",
      "NEVER dump electronics in open water bodies.",
    ],
    dontsHi: [
      "पावर सप्लाई यूनिट को नंगे हाथों से कभी न छुएं।",
      "प्लास्टिक बॉडी को तांबा निकालने के लिए कभी न जलाएं।",
      "ई-कचरे को कभी पानी या खुले में न फेंकें।",
    ],
    speechTextEn:
      "Safety guidance for Computers and General Electronics. Ensure devices are unplugged. Lift with knees. Never burn plastic casings to salvage wires.",
    speechTextHi:
      "कंप्यूटर और सामान्य इलेक्ट्रॉनिक्स के लिए निर्देश। प्लग निकाल कर काम करें। प्लास्टिक को कभी न जलाएं।",
  },
];

function getCategoryIcon(name: string) {
  switch (name) {
    case "battery":
      return <BatteryCharging className="w-8 h-8 text-rose-600" />;
    case "display":
      return <Tv className="w-8 h-8 text-amber-600" />;
    case "pcb":
      return <Cpu className="w-8 h-8 text-emerald-600" />;
    case "fridge":
      return <Flame className="w-8 h-8 text-rose-600" />;
    case "lamp":
      return <Lightbulb className="w-8 h-8 text-amber-600" />;
    default:
      return <Laptop className="w-8 h-8 text-blue-600" />;
  }
}

export function SafetyCenterPage() {
  const { language } = useLanguage();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ttsSupported, setTtsSupported] = useState(true);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setTtsSupported(false);
    }
  }, []);

  const handleSpeak = (item: SafetyGuideline) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setTtsSupported(false);
      return;
    }

    if (playingId === item.id) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = language === "hi" ? item.speechTextHi : item.speechTextEn;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Request Hindi or English voice where available
    const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    if (language === "hi") {
      const hiVoice = voices.find((v) => v.lang.startsWith("hi") || v.name.includes("Hindi"));
      if (hiVoice) utterance.voice = hiVoice;
      utterance.lang = "hi-IN";
    } else {
      const enVoice = voices.find((v) => v.lang.startsWith("en"));
      if (enVoice) utterance.voice = enVoice;
      utterance.lang = "en-US";
    }

    utterance.rate = 0.95;
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);

    setPlayingId(item.id);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/collector"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> {language === "hi" ? "कलेक्टर होम" : "Collector Home"}
        </Link>
        <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded font-semibold border border-emerald-200">
          {language === "hi" ? "सुरक्षा दिशानिर्देश" : "Zero-Harm Guidelines"}
        </span>
      </div>

      {/* Main Title Card */}
      <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {language === "hi"
                ? "ई-कचरा सुरक्षा एवं संचालन केंद्र"
                : "E-Waste Safety & Handling Center"}
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              {language === "hi"
                ? "अनौपचारिक कलेक्टरों के लिए सचित्र एवं बोलकर बताने वाला सुरक्षा गाइड। स्वास्थ्य की रक्षा करें और खुले में कभी न जलाएं।"
                : "Pictorial & audio safety guidance for informal collectors. Protect your health and the environment through safe storage, protective gear, and zero open burning."}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center shrink-0">
            <Volume2 className="w-6 h-6 text-emerald-700 mx-auto mb-1" />
            <span className="text-[11px] font-bold text-emerald-900 block">
              {language === "hi" ? "ऑडियो सहायता सक्षम" : "Audio Guide Ready"}
            </span>
          </div>
        </div>

        {!ttsSupported && (
          <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg text-xs">
            {language === "hi"
              ? "आपके ब्राउज़र में आवाज़ (TTS) उपलब्ध नहीं है। कृपया लिखे हुए नियमों का पालन करें।"
              : "Speech synthesis is not supported on this browser. Please read the visual safety rules below."}
          </div>
        )}
      </div>

      {/* Safety Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SAFETY_DATA.map((item) => {
          const isPlaying = playingId === item.id;
          const isHigh = item.hazardLevel === "HIGH";

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl shadow-sm border transition-all p-5 sm:p-6 flex flex-col justify-between ${
                isHigh ? "border-rose-200" : "border-slate-200"
              }`}
            >
              <div>
                {/* Top Bar: Icon, Title & Hazard Badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {getCategoryIcon(item.iconName)}
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                        {language === "hi" ? item.titleHi : item.titleEn}
                      </h2>
                      <span
                        className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded mt-1 ${
                          isHigh
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {isHigh
                          ? language === "hi"
                            ? "अत्यधिक खतरनाक"
                            : "HIGH HAZARD"
                          : language === "hi"
                          ? "मध्यम खतरा"
                          : "MEDIUM HAZARD"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hazard description */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs text-slate-700 flex items-start gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p>{language === "hi" ? item.hazardHi : item.hazardEn}</p>
                </div>

                {/* DOs Section */}
                <div className="space-y-2 mb-4">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {language === "hi" ? "क्या करें (सुरक्षित नियम)" : "DO THIS (Safe Handling)"}
                  </h3>
                  <ul className="space-y-1.5 pl-1 text-xs text-slate-700">
                    {(language === "hi" ? item.dosHi : item.dosEn).map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* DONTs Section */}
                <div className="space-y-2 mb-4">
                  <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    {language === "hi" ? "क्या कभी न करें (गंभीर खतरा)" : "NEVER DO (Dangerous)"}
                  </h3>
                  <ul className="space-y-1.5 pl-1 text-xs text-rose-900 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 font-medium">
                    {(language === "hi" ? item.dontsHi : item.dontsEn).map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-600 font-bold">✕</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Audio Control Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  {language === "hi" ? "सरल ऑडियो सुनें" : "Listen in your language"}
                </span>
                <button
                  type="button"
                  onClick={() => handleSpeak(item)}
                  className={`min-h-10 px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                    isPlaying
                      ? "bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-300 animate-pulse"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                  aria-label={`Read aloud guidelines for ${item.titleEn}`}
                >
                  {isPlaying ? (
                    <>
                      <VolumeX className="w-4 h-4" />
                      {language === "hi" ? "रोकें" : "Stop"}
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      {language === "hi" ? "ऑडियो सुनें" : "Listen Audio"}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
