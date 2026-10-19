import type { zh } from './zh'

export const hi = {
  blToggle: 'अनुवाद साथ-साथ',
  blToggleTip:
    'हर पेज के बगल में सहेजा गया अनुवाद दिखाता है। इसे चालू करने भर से AI को कुछ नहीं भेजा जाता।',
  blLanguage: 'अनुवाद की भाषा',
  blStoredLangs: 'सहेजे गए अनुवाद',
  blOtherLangs: 'अन्य भाषाएँ',
  blLoading: 'दस्तावेज़ की संरचना पढ़ी जा रही है… ({done}/{total} पेज)',
  blLoadingStart: 'दस्तावेज़ की संरचना पढ़ी जा रही है…',
  blFailed: 'दस्तावेज़ की संरचना नहीं पढ़ी जा सकी, इसलिए अनुवाद कॉलम नहीं दिखाया जा सकता।',
  blUnavailable:
    'अनुवाद कॉलम उपलब्ध नहीं है: फ़ाइल सहेजी नहीं गई है, या यह विंडो दस्तावेज़ की संरचना नहीं पढ़ सकती।',
  blUnsavedPages: 'अनुवाद कॉलम को पेजों से मिलाने के लिए सहेजें',
  blContinued: 'पिछले पेज से जारी',
  blCollapseAsk: 'अनुवाद कॉलम समेटें?',
  blCollapse: 'समेटें',
  blKeep: 'रहने दें',
  blExpand: 'अनुवाद कॉलम फैलाएँ',
  blFontSmaller: 'अनुवाद का पाठ छोटा करें',
  blFontLarger: 'अनुवाद का पाठ बड़ा करें',
  blResize: 'अनुवाद कॉलम की चौड़ाई बदलें',
  blClose: 'अनुवाद साथ-साथ बंद करें',
  blPageHeader: 'पेज {page}',
  blPageCount: 'अनुवादित {translated}/{units}',
  blNoText: 'इस पेज पर अनुवाद के लिए कोई पाठ नहीं है।',
  blPendingTip: 'अभी अनुवाद नहीं हुआ (मूल पाठ)।',
  blFailedTip: 'इस अनुच्छेद का अनुवाद नहीं हो सका (मूल पाठ)।',
  blEditedTip: 'किसी व्यक्ति द्वारा संपादित अनुवाद।',
} satisfies Record<keyof typeof zh, string>
