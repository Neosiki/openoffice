import type { zh } from './zh'

export const hi = {
  cardChecking: 'जाँच हो रही है…',
  cardNotInstalled: 'इंस्टॉल नहीं है',
  cardSignedOut: 'साइन इन नहीं है',
  cardReady: 'कनेक्ट है',
  cardReadyPlan: 'कनेक्ट है · {plan}',
  cardMetered: 'साइन इन है, पर सदस्यता से नहीं',
  cardMeteredAccepted: 'उपयोग में · उपयोग के अनुसार शुल्क',
  cardError: 'कनेक्शन की जाँच नहीं हो सकी',
  actionInstall: 'इंस्टॉल करें',
  actionLogin: 'साइन इन करें',
  actionRecheck: 'फिर से जाँचें',
  actionAcceptMetered: 'फिर भी उपयोग करें',
  actionInstallHelp: 'आधिकारिक इंस्टॉल गाइड',
  actionOpenSettings: 'सेटिंग खोलें',
  actionDismiss: 'बंद करें',
  installNote: '{vendor} का आधिकारिक इंस्टॉल कमांड एक नई टर्मिनल विंडो में चलेगा।',
  loginNote: 'जो साइन-इन पेज खुलेगा वह {vendor} का अपना है।',
  meteredWarning: 'यह सदस्यता नहीं है: जितना उपयोग करेंगे उतना शुल्क लगेगा।',
  meteredMeaning:
    'यह साइन-इन API कुंजी या उपयोग के अनुसार भुगतान वाले खाते से है, या इसका प्रकार पक्का नहीं हो सका। "फिर भी उपयोग करें" चुनने पर AI इसी कनेक्शन से चलेगा और हर अनुरोध का शुल्क उसी खाते से लिया जाएगा।',
  connectTitle: 'AI का उपयोग करने के लिए सदस्यता कनेक्ट करें',
  connectBody:
    'AI आपकी मौजूदा Claude या Codex सदस्यता पर चलता है। किसी API कुंजी की ज़रूरत नहीं है।',
  connectProviderTitle: '{provider} कनेक्शन का अभी उपयोग नहीं किया जा सकता',
  connectKeyBody:
    '{provider} का सेटअप अभी पूरा नहीं हुआ है। इसे सेटिंग में पूरा करें या कोई दूसरा AI चुनें।',
  errNotConnected: 'कोई AI कनेक्ट नहीं है। पहले Claude या Codex सदस्यता कनेक्ट करें।',
  errNotInstalled: 'इस PC पर {provider} प्रोग्राम नहीं मिला।',
  errSignedOut: '{provider} का साइन-इन समाप्त हो गया है। जारी रखने के लिए फिर से साइन इन करें।',
  errRateLimit: '{provider} सदस्यता की सीमा पूरी हो गई है।',
  errRateLimitReset: '{provider} सदस्यता की सीमा पूरी हो गई है। यह {time} पर रीसेट होगी।',
  errUnsafeTools:
    '{provider} प्रोग्राम अपने टूल चालू रखकर शुरू हुआ, इसलिए सुरक्षा के लिए यह रन रोक दिया गया।',
  errMeteredNotAccepted:
    '{provider} कनेक्शन पर उपयोग के अनुसार शुल्क लगता है और आपने अभी इसकी अनुमति नहीं दी है। इसका उपयोग करने के लिए कनेक्शन सेटिंग में "फिर भी उपयोग करें" चुनें।',
  errNeedsUpdate:
    '{provider} प्रोग्राम इस सुविधा के लिए बहुत पुराना है। इसे अपडेट करके फिर से कोशिश करें।',
  errHeadlessLimit: 'स्वचालित अनुरोधों की प्रति घंटा सीमा पूरी हो गई है।',
  errHeadlessLimitReset:
    'स्वचालित अनुरोधों की प्रति घंटा सीमा पूरी हो गई है। {time} से अनुरोध फिर संभव होंगे।',
  continueWith: '{provider} के साथ जारी रखें',
  continueMeteredNote:
    '{provider} कनेक्शन सदस्यता नहीं है: जारी रखने पर उपयोग के अनुसार शुल्क लगेगा।',
  usageLine: '{percent}% उपयोग हुआ · {time} पर रीसेट',
  usageWindowFiveHour: '5 घंटे की सीमा',
  usageWindowSevenDay: '7 दिन की सीमा',
  noticeTitle: 'अपनी सदस्यता से AI का उपयोग करने से पहले',
  noticeSend:
    'दस्तावेज़ की सामग्री और आपकी बातचीत आपके अपने खाते से Anthropic या OpenAI को भेजी जाती है।',
  noticeTraining:
    'उस सामग्री का उपयोग AI के प्रशिक्षण में होगा या नहीं, यह उस कंपनी में आपके अपने खाते की सेटिंग से तय होता है।',
  noticeCodexHistory: 'Codex बातचीत की सामग्री इस PC पर रख सकता है।',
  noticeAck: 'समझ गया',
  codexNotice:
    'किसी ऐप के अंदर Codex सदस्यता का उपयोग करना OpenAI द्वारा आधिकारिक रूप से सुझाया गया तरीका नहीं है।',
  truncatedNotice: 'इनपुट बहुत लंबा था, इसलिए भेजने से पहले उसका कुछ हिस्सा काट दिया गया।',
  pickerAuto: 'स्वचालित',
  pickerAutoUsing: 'स्वचालित · {provider}',
  pickerDefaultModel: 'डिफ़ॉल्ट मॉडल',
  pickerSubscription: 'सदस्यता',
  pickerPaid: 'सशुल्क',
  pickerPaidTitle: 'उपयोग के अनुसार शुल्क, सदस्यता में शामिल नहीं',
  pickerNotConnected: 'AI कनेक्ट करें',
} satisfies Record<keyof typeof zh, string>
