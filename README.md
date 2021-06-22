# ximsswrapper
ximsswrapper.js is intended for use in SIPNET web projects. It is the main engine for telephone signaling ([XIMSS protocol](https://www.communigate.ru/CommuniGatePro/russian/XMLAPI.html)) and media data transmission through the [WebRTC](https://webrtc.org/) framework.

Simple example to start the call:

```javascript
ximssSession.doLogin(login, password, domain, false)
ximssSession.onXimssSuccessLogin=function(){ /* positive/negative result */ }
ximssSession.doStartCall(peer,line, audioInputSelect.value, true)
```

The rest of the methods and functions can be explored in the source code.
