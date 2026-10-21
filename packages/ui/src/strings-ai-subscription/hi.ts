import type { zh } from './zh'

export const hi = {
  aiAssistant: 'AI सहायक',
  cardChecking: 'जाँच हो रही है…',
  cardNotInstalled: 'इंस्टॉल नहीं है',
  cardSignedOut: 'साइन इन नहीं है',
  cardSigningIn: 'साइन इन हो रहा है…',
  cardReady: 'कनेक्ट है',
  cardReadyPlan: 'कनेक्ट है · {plan}',
  cardMetered: 'साइन इन है, पर सदस्यता से नहीं',
  cardMeteredAccepted: 'उपयोग में · उपयोग के अनुसार शुल्क',
  cardError: 'कनेक्शन की जाँच नहीं हो सकी',
  cardErrNeedsUpdate:
    'इस पीसी पर {provider} प्रोग्राम बहुत पुराना है। इसे अपडेट करके फिर से जाँचें।',
  cardErrNeedsUpdateVersion:
    'इस पीसी पर {provider} प्रोग्राम ({version}) बहुत पुराना है; {minimum} या उससे नया संस्करण चाहिए। टर्मिनल में {command} चलाएँ, फिर से जाँचें।',
  cardErrNeedsUpdatePath: 'यह ऐप जो फ़ाइल चलाता है:',
  cardErrNeedsUpdateWindows:
    'WSL (Ubuntu) में या किसी दूसरे फ़ोल्डर में {provider} अपडेट करने से यह फ़ाइल नहीं बदलती। Windows PowerShell में {command} चलाएँ।',
  cardErrTimeout: '{provider} प्रोग्राम ने समय पर जवाब नहीं दिया। थोड़ी देर बाद फिर से जाँचें।',
  cardErrFailed: '{provider} की जाँच करते समय कोई समस्या हुई। फिर से जाँचें।',
  actionInstall: 'इंस्टॉल करें',
  actionLogin: 'साइन इन करें',
  actionLoginWindow: 'ब्राउज़र नहीं खुला, या कोई कोड दिखा रहा है?',
  actionRecheck: 'फिर से जाँचें',
  actionAcceptMetered: 'फिर भी उपयोग करें',
  actionInstallHelp: 'आधिकारिक इंस्टॉल गाइड',
  actionOpenSettings: 'सेटिंग खोलें',
  actionDismiss: 'बंद करें',
  actionSwitchAccount: 'किसी दूसरे खाते से साइन इन करें',
  actionLogout: 'साइन आउट करें',
  installNote: '{vendor} का आधिकारिक इंस्टॉल कमांड एक नई टर्मिनल विंडो में चलेगा।',
  loginNote: 'जो साइन-इन पेज खुलेगा वह {vendor} का अपना है।',
  signingInBrowserNote:
    'खुले हुए ब्राउज़र में अपने {vendor} खाते में साइन इन करें और अनुमति दें। पूरा होते ही कनेक्शन अपने आप हो जाएगा।',
  signingInWindowNote:
    'अगर ब्राउज़र नहीं खुला, तो अभी खुली विंडो में दिखा पता कॉपी करके ब्राउज़र में खोलें। जब ब्राउज़र कोई कोड दिखाए, तो उसे कॉपी करके उसी विंडो में एक बार पेस्ट करें और Enter दबाएँ। हो सकता है कि पेस्ट किया गया कोड विंडो में न दिखे।',
  meteredWarning: 'यह सदस्यता नहीं है: जितना उपयोग करेंगे उतना शुल्क लगेगा।',
  meteredMeaning:
    'यह साइन-इन API कुंजी या उपयोग के अनुसार भुगतान वाले खाते से है, या इसका प्रकार पक्का नहीं हो सका। "फिर भी उपयोग करें" चुनने पर AI इसी कनेक्शन से चलेगा और हर अनुरोध का शुल्क उसी खाते से लिया जाएगा।',
  connectTitle: 'शुरू करने के लिए AI कनेक्ट करें',
  connectBody:
    'AI आपकी मौजूदा Claude या Codex सदस्यता पर चलता है। किसी API कुंजी की ज़रूरत नहीं है।',
  connectProviderTitle: '{provider} कनेक्शन का अभी उपयोग नहीं किया जा सकता',
  connectKeyBody:
    '{provider} का सेटअप अभी पूरा नहीं हुआ है। इसे सेटिंग में पूरा करें या कोई दूसरा AI चुनें।',
  errNotConnected:
    'कोई AI कनेक्ट नहीं है। पहले Claude या Codex सदस्यता, या कोई मुफ़्त AI कनेक्ट करें।',
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
  connectFreeHint: 'सदस्यता नहीं है? आप सेटिंग में लगभग एक मिनट में मुफ़्त AI कनेक्ट कर सकते हैं।',
  actionConnectFree: 'मुफ़्त AI कनेक्ट करें',
  errFreeLimit:
    'आज का मुफ़्त उपयोग समाप्त हो गया है। कल दोबारा कोशिश करें, या सेटिंग में कोई दूसरा AI चुनें।',
  errFreeLimitReset: 'आज का मुफ़्त उपयोग समाप्त हो गया है। आप {time} से इसे फिर उपयोग कर सकते हैं।',
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
  noticeCodexHistory:
    'यह ऐप Codex में बातचीत का इतिहास सहेजना बंद कर देता है, लेकिन Codex फिर भी अपने डायग्नोस्टिक लॉग इस PC पर रख सकता है।',
  noticePdfWholeDocument:
    'PDF संपादक में, AI से पेज पढ़ने और दस्तावेज़ के अनुवाद में पेजों की छवियाँ और दस्तावेज़ का पूरा टेक्स्ट भेजा जा सकता है।',
  noticeAck: 'समझ गया',
  codexNotice:
    'किसी ऐप के अंदर Codex सदस्यता का उपयोग करना OpenAI द्वारा आधिकारिक रूप से सुझाया गया तरीका नहीं है।',
  truncatedNotice: 'इनपुट बहुत लंबा था, इसलिए भेजने से पहले उसका कुछ हिस्सा काट दिया गया।',
  pickerAuto: 'स्वचालित',
  pickerAutoUsing: 'स्वचालित · {provider}',
  pickerAutoUsingModel: 'स्वचालित · {provider} · {model}',
  pickerDefaultModel: 'डिफ़ॉल्ट मॉडल',
  pickerDefaultModelNamed: 'डिफ़ॉल्ट मॉडल · {model}',
  pickerSubscription: 'सदस्यता',
  pickerPaid: 'सशुल्क',
  pickerPaidTitle: 'उपयोग के अनुसार शुल्क, सदस्यता में शामिल नहीं',
  pickerNotConnected: 'AI कनेक्ट करें',
} satisfies Record<keyof typeof zh, string>
