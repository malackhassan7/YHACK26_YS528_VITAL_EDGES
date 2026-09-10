import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Scale, ShieldCheck, Info, Sparkles } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

interface MaterialPriceInfo {
  id: string;
  nameEn: string;
  nameHi: string;
  code: string;
  basePriceMin: number;
  basePriceMax: number;
  baseMid: number;
  unit: string;
  conditionBreakdownEn: string;
  conditionBreakdownHi: string;
  handlingTipEn: string;
  handlingTipHi: string;
}

const MATERIAL_CATALOG: MaterialPriceInfo[] = [
  {
    id: "mat-pcb",
    nameEn: "Printed Circuit Boards (PCBs) & Motherboards",
    nameHi: "सर्किट बोर्ड (PCBs) और मदरबोर्ड",
    code: "CIRCUIT_BOARDS",
    basePriceMin: 400,
    basePriceMax: 560,
    baseMid: 480,
    unit: "kg",
    conditionBreakdownEn: "High-grade intact server boards: ₹520/kg; Mixed consumer scrap: ₹440/kg.",
    conditionBreakdownHi: "उच्च-श्रेणी के सर्वर बोर्ड: ₹520/किलो; सामान्य स्क्रैप: ₹440/किलो।",
    handlingTipEn: "Keep dry and intact. Never burn or acid-wash boards.",
    handlingTipHi: "सूखा रखें। धातु निकालने के लिए कभी न जलाएं।",
  },
  {
    id: "mat-mobile",
    nameEn: "Smartphones & Mobile Devices",
    nameHi: "स्मार्टफोन और मोबाइल फोन",
    code: "MOBILE_PHONES",
    basePriceMin: 280,
    basePriceMax: 450,
    baseMid: 365,
    unit: "kg",
    conditionBreakdownEn: "Working / repairable: +20%; Damaged scrap: base rate.",
    conditionBreakdownHi: "चालू हालत: +20% बोनस; टूटा हुआ स्क्रैप: आधार दर।",
    handlingTipEn: "Tape contacts if lithium battery is detached.",
    handlingTipHi: "यदि बैटरी अलग है तो संपर्कों पर टेप लगाएं।",
  },
  {
    id: "mat-laptop",
    nameEn: "Laptops & Desktop Computers",
    nameHi: "लैपटॉप और कंप्यूटर सिस्टम",
    code: "LAPTOPS_COMPUTERS",
    basePriceMin: 200,
    basePriceMax: 340,
    baseMid: 270,
    unit: "kg",
    conditionBreakdownEn: "Complete towers with SMPS & RAM: ₹310/kg; Stripped chassis: ₹220/kg.",
    conditionBreakdownHi: "पूरा सिस्टम (रैम/एसएमपीएस सहित): ₹310/किलो; खाली चेसिस: ₹220/किलो।",
    handlingTipEn: "Do not crush internal capacitors or screens.",
    handlingTipHi: "आंतरिक कैपेसिटर या स्क्रीन को न तोड़ें।",
  },
  {
    id: "mat-cables",
    nameEn: "Insulated Cables & Copper Wires",
    nameHi: "तांबे के तार और केबल",
    code: "CABLES_WIRES",
    basePriceMin: 180,
    basePriceMax: 320,
    baseMid: 250,
    unit: "kg",
    conditionBreakdownEn: "Heavy gauge power cables: ₹300/kg; Ribbon/data wires: ₹190/kg.",
    conditionBreakdownHi: "मोटे बिजली के तार: ₹300/किलो; पतले डेटा केबल: ₹190/किलो।",
    handlingTipEn: "Bundle and coil neatly. Never burn rubber insulation.",
    handlingTipHi: "बंडल बनाएं। प्लास्टिक कवर कभी न जलाएं।",
  },
  {
    id: "mat-battery",
    nameEn: "Industrial & Consumer Batteries",
    nameHi: "बैटरियां और पावर पैक",
    code: "BATTERIES",
    basePriceMin: 80,
    basePriceMax: 140,
    baseMid: 110,
    unit: "kg",
    conditionBreakdownEn: "Heavy Lead-Acid: ₹120/kg; Li-Ion modules: ₹95/kg.",
    conditionBreakdownHi: "लेड-एसिड बैटरी: ₹120/किलो; लिथियम सेल: ₹95/किलो।",
    handlingTipEn: "Isolate terminals with electrical tape. Keep shaded.",
    handlingTipHi: "टर्मिनल पर टेप लगाएं और धूप से दूर रखें।",
  },
  {
    id: "mat-display",
    nameEn: "Monitors, Televisions & Displays",
    nameHi: "मॉनिटर, टीवी और डिस्प्ले स्क्रीन",
    code: "DISPLAYS_MONITORS",
    basePriceMin: 60,
    basePriceMax: 110,
    baseMid: 85,
    unit: "kg",
    conditionBreakdownEn: "Flat LED/LCD screens: ₹100/kg; Heavy CRT monitors: ₹70/kg.",
    conditionBreakdownHi: "एलईडी/एलसीडी स्क्रीन: ₹100/किलो; सीआरटी टीवी: ₹70/किलो।",
    handlingTipEn: "Handle gently to avoid glass fracture.",
    handlingTipHi: "ग्लास टूटने से बचाने के लिए सावधानी से रखें।",
  },
  {
    id: "mat-mixed",
    nameEn: "Mixed Consumer Electronic Scrap",
    nameHi: "मिश्रित उपभोक्ता ई-कचरा",
    code: "MIXED_ELECTRONICS",
    basePriceMin: 90,
    basePriceMax: 160,
    baseMid: 125,
    unit: "kg",
    conditionBreakdownEn: "Small household electronics, routers, keyboards, adapters.",
    conditionBreakdownHi: "छोटे घरेलू उपकरण, राउटर, कीबोर्ड, चार्जर।",
    handlingTipEn: "Separate any swollen batteries or leaking liquids.",
    handlingTipHi: "रिसती हुई बैटरियों को अलग कर लें।",
  },
];

export function PriceCatalogPage() {
  const { language } = useLanguage();
  const [search, setSearch] = useState("");

  const filtered = MATERIAL_CATALOG.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.nameEn.toLowerCase().includes(q) ||
      item.nameHi.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/collector"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> {language === "hi" ? "कलेक्टर होम" : "Collector Home"}
        </Link>
        <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded font-semibold border border-emerald-200">
          {language === "hi" ? "पारदर्शी संदर्भ दरें" : "Verified Reference Prices"}
        </span>
      </div>

      {/* Main Title Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {language === "hi"
                ? "पारदर्शी ई-कचरा संदर्भ मूल्य सूची"
                : "Reference E-Waste Price Catalog"}
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl">
              {language === "hi"
                ? "अधिकृत रीसाइक्लिंग पारिस्थितिकी तंत्र द्वारा निर्धारित निष्पक्ष संदर्भ मूल्य। अंतिम भुगतान प्रमाणित डिजिटल तराजू के भौतिक वजन पर निर्भर करता है।"
                : "Transparent benchmark prices established for formal circular recycling. Recycler offers are validated against these ranges to protect collectors from low-ball bids."}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center shrink-0">
            <Scale className="w-6 h-6 text-emerald-700 mx-auto mb-1" />
            <span className="text-[11px] font-bold text-emerald-900 block">
              {language === "hi" ? "उचित मूल्य मॉडल" : "Fair Value Engine"}
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              language === "hi"
                ? "सामग्री खोजें (उदा. पीसीबी, मोबाइल, लैपटॉप, तांबा)..."
                : "Search e-waste categories (e.g. PCB, Mobile, Laptop, Copper)..."
            }
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Fair Value Formula Explainer Card */}
      <div className="bg-emerald-900 text-white rounded-xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{language === "hi" ? "निष्पक्ष मूल्य निर्धारण सिद्धांत" : "How Fair Prices Are Calculated"}</span>
        </div>
        <p className="text-xs text-emerald-100 font-mono bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-800">
          Fair Price (₹/kg) = Base Material Reference × Condition Factor × Quantity Factor × Regional Factor
        </p>
        <p className="text-[11px] text-emerald-200">
          {language === "hi"
            ? "* सत्यापन विश्वास स्कोर मूल्य को कम या ज्यादा नहीं करता है, यह केवल लिस्टिंग की प्रामाणिकता को दर्शाता है।"
            : "* Verification trust score does not alter material monetary value; it represents listing authenticity only."}
        </p>
      </div>

      {/* Material Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-emerald-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">
                    {language === "hi" ? item.nameHi : item.nameEn}
                  </h2>
                  <span className="text-[11px] font-mono text-slate-500">{item.code}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-extrabold text-emerald-800">
                    ₹{item.basePriceMin} - ₹{item.basePriceMax}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold">/ {item.unit}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-1.5 mt-3">
                <p className="text-slate-700">
                  <strong>{language === "hi" ? "स्थिति के आधार पर:" : "Condition:"}</strong>{" "}
                  {language === "hi" ? item.conditionBreakdownHi : item.conditionBreakdownEn}
                </p>
                <p className="text-emerald-900 font-medium">
                  <strong>{language === "hi" ? "सुरक्षा टिप:" : "Handling:"}</strong>{" "}
                  {language === "hi" ? item.handlingTipHi : item.handlingTipEn}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {language === "hi" ? "प्रमाणित संदर्भ" : "Circular Reference"}
              </span>
              <Link
                to="/collector/lots/new"
                className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                {language === "hi" ? "+ इस श्रेणी का लॉट बनाएं" : "+ Create Lot"} →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 text-sm">
          <Info className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          {language === "hi" ? "कोई सामग्री नहीं मिली。" : "No matching materials found."}
        </div>
      )}
    </div>
  );
}
