'use strict'

var DEBUG_SIPNET = false;

function getCookie(name) {
    var matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

function XimssSession() {

    if (getCookie('DEBUG_SIPNET') === 'true') {
        DEBUG_SIPNET = true;
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    var earlyMedia = false;
//    var configuration = {"iceServers": []}

    var configuration= {
        'iceServers': [
            {
                'url': 'stun:stun.l.google.com:19302'
            },
            {
                'url': 'turn:212.53.35.25:20302',
                'credential': 'sipnet',
                'username': 'sipnet'
            }
        ],
        'bundlePolicy': 'max-compat'
    };


    var PhotoUtil = {
        getOptimizedPhotoData: function (data, isUrl, callback) {
            var MAX_WIDTH = 128,
                MAX_HEIGHT = 128,
                canvas,
                context,
                image;

            if (!data) {
                if (callback) {
                    callback();
                }
                return;
            }

            canvas = document.createElement("canvas");
            canvas.width = MAX_WIDTH;
            canvas.height = MAX_HEIGHT;
            context = canvas.getContext("2d");
            image = document.createElement("img");
            image.src = !isUrl ? "data:image/png;base64," + data : data;
            image.setAttribute("crossOrigin", "anonymous");


            image.onload = function () {

                var width = image.width,
                    height = image.height;
                if (width > height) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                } else {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                context.drawImage(image, 0 - (width - MAX_WIDTH) / 2, 0 -
                    (height - MAX_HEIGHT) / 2, width, height);

                if (callback) {
                    callback(canvas.toDataURL("image/png"));
                } else {
                    callback();

                }
            };

            image.onerror = function () {
                callback();
            }
        }
    };

    var vCardUtil = {
        getPhotoData: function (vCardXML, callback) {
            var imageData = vCardUtil.getValue(vCardXML, "PHOTO BINVAL");
            PhotoUtil.getOptimizedPhotoData(imageData, false, callback);
        },

        getValue: function (vCardXML, nodeName) {
            var node;

            if (!vCardXML || !nodeName) {
                return;
            }
            node = vCardXML.querySelector(nodeName);
            if (node) {
                return node.textContent;
            }
        },

        setValue: function (vCardXML, nodeName, value) {
            var oldNode,
                xmlDoc,
                childs,
                parentNode,
                i,
                node;

            if (!vCardXML || !nodeName) {
                return;
            }

            oldNode = vCardXML.querySelector(nodeName);
            if (oldNode) {
                oldNode.parentNode.removeChild(oldNode);
            }

            if (!value) {
                return;
            }

            childs = nodeName.split(" ");
            xmlDoc = vCardXML.ownerDocument;

            parentNode = vCardXML;
            for (i = 0; i < childs.length; i++) {
                node = parentNode.querySelector(childs[i]);
                if (!node || node.parentNode !== parentNode) {
                    node = xmlDoc.createElement(childs[i]);
                    parentNode.appendChild(node);
                }
                parentNode = node;
            }
            parentNode.appendChild(xmlDoc.createTextNode(value));
        },

        getValues: function (vCardXML, nodeName) {
            var nodes,
                values = [],
                i,
                value;

            if (!vCardXML || !nodeName) {
                return [];
            }
            nodes = vCardXML.querySelectorAll(nodeName);
            for (i = 0; i < nodes.length; i++) {

                if (nodes[i].lastChild) {
                    value = nodes[i].lastChild.textContent;
                    if (value) {
                        values.push(value);
                    }

                }


            }
            return values;
        },

        getTypedValues: function (vCardXML, nodeName) {
            var nodes,
                i,
                type,
                value,
                typedValues = [],
                typedValue;

            if (!vCardXML || !nodeName) {
                return [];
            }
            nodes = vCardXML.querySelectorAll(nodeName);
            for (i = 0; i < nodes.length; i++) {
                if (nodes[i].childNodes.length > 2) {
                    type = nodes[i].firstChild.tagName.toUpperCase();
                } else {
                    type = "home";
                }

                if (nodes[i].lastChild)
                    value = nodes[i].lastChild.textContent;
                if (value) {
                    typedValue = {type: type, value: value};
                    typedValues.push(typedValue);
                }
            }
            return typedValues;
        },

        appendMultiValue: function (vCardXML, nodeName, value) {
            var childs,
                xmlDoc,
                parentNode,
                i,
                node;

            if (!vCardXML || !nodeName || !value) {
                return;
            }

            childs = nodeName.split(" ");
            xmlDoc = vCardXML.ownerDocument;

            parentNode = vCardXML;
            for (i = 0; i < childs.length; i++) {
                node = xmlDoc.createElement(childs[i]);
                parentNode.appendChild(node);
                parentNode = node;
            }
            parentNode.appendChild(xmlDoc.createTextNode(value));
        },

        getVCard: function (vCardXML) {

            var vcard = {
                "ADR": {
                    "HOME": {},
                    "WORK": {}
                }
            };


            var types = {
                    HOME: "HOME",
                    WORK: "WORK",
                    CELL: "CELL",
                    FAX: "FAX",
                    AGENT: "AGENT"
                },
                addressParts = [
                    {name: "POBOX", title: "HeaderNames.postOfficeBox"},
                    {name: "EXTADD", title: "HeaderNames.suite"},
                    {name: "STREET", title: "HeaderNames.street"},
                    {name: "LOCALITY", title: "HeaderNames.l"},
                    {name: "REGION", title: "HeaderNames.st"},
                    {name: "PCODE", title: "HeaderNames.postalCode"},
                    {name: "CTRY", title: "HeaderNames.c"}
                ],
                nodesDefault = [
                    {name: "X-FILE-AS VALUE", title: "HeaderNames.FN", block: "name", type: "single"},
                    {name: "N PREFIX", title: "HeaderNames.socialTitle", block: "name", type: "single"},
                    {name: "N GIVEN", title: "HeaderNames.givenName", block: "name", type: "single"},
                    {name: "N MIDDLE", title: "HeaderNames.middleName", block: "name", type: "single"},
                    {name: "N FAMILY", title: "HeaderNames.sn", block: "name", type: "single"},
                    {name: "N SUFFIX", title: "HeaderNames.generationQualifier", block: "name", type: "single"},
                    {name: "BDAY", title: "HeaderNames.BDAY", block: "name", type: "date"},

                    {name: "ORG ORGNAME", title: "HeaderNames.o", block: "org", type: "single"},
                    {name: "ORG ORGUNIT", title: "HeaderNames.ou", block: "org", type: "single"},
                    {name: "TITLE VALUE", title: "HeaderNames.TITLE", block: "org", type: "single"},
                    {name: "LABEL VALUE", title: "HeaderNames.LABEL", block: "other", type: "single"},
                    {name: "ROLE VALUE", title: "HeaderNames.ROLE", block: "other", type: "single"},
                    {name: "URL VALUE", title: "HeaderNames.URL", block: "other", type: "single"},
                    {name: "NOTE VALUE", title: "HeaderNames.NOTE", block: "", type: "single"},
                    {name: "ALIAS VALUE", title: "HeaderNames.ALIAS", block: "", type: "single"},

                    {
                        name: "EMAIL", title: "HeaderNames.EMAIL", block: "emailtel", type: "multi",
                        placeholder: "HeaderNames.EMAIL",
                        allowedTypes: [types.HOME, types.WORK],
                        defaultType: types.HOME
                    },

                    {
                        name: "TEL", title: "HeaderNames.TEL", block: "emailtel", type: "multi",
                        placeholder: "HeaderNames.TEL",
                        allowedTypes: [types.HOME, types.WORK, types.CELL, types.FAX, types.AGENT],
                        defaultType: types.CELL
                    },

                    {
                        name: "ADR", title: "HeaderNames.ADR", block: "", type: "adr",
                        placeholder: "CreateInGroupButton",
                        allowedTypes: [types.HOME, types.WORK],
                        defaultType: types.HOME,
                        parts: addressParts
                    },

                    {name: "PHOTO BINVAL", title: "HeaderNames.PHOTO", block: "", type: "photo"}
                ],
                nodes = nodesDefault,

                groupNodes = [
                    {name: "FN VALUE", title: "HeaderNames.Name", block: "group", type: "single"},
                    {name: "NOTE VALUE", title: "HeaderNames.NOTE", block: "group", type: "single"},
                    {name: "MEMBER", title: "HeaderNames.Attendees", block: "", type: "member"}
                ];

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (node.type === "single") {
                    vcard[node.name] = vCardUtil.getValue(vCardXML, node.name);

                } else if (node.type === "multi") {

                    vcard[node.name] = vCardUtil.getTypedValues(vCardXML, node.name);

                } else if (node.type === "adr") {
                    nodes = vCardXML.querySelectorAll(node.name);

                    var allowTypes = node.allowedTypes;
                    var type = "";

                    for (var z = 0; z < nodes.length; z++) {
                        node = nodes[z].firstChild;
                        if (node) {
                            type = node.tagName.toUpperCase();
                        }

                        if (allowTypes.indexOf(type) === -1) {
                            type = "HOME";
                        }
                        var partValues = [];
                        var nameToValue = {};
                        if (node) {
                            node = node.nextSibling;
                        }
                        while (node !== null) {
                            var partName = node.tagName.toUpperCase();
                            var partValue = node.textContent;
                            nameToValue[partName] = partValue;
                            node = node.nextSibling;
                        }
                        var addressStringParts = [];
                        for (var j = 0; j < addressParts.length; j++) {
                            var part = addressParts[j];
                            var value = "";
                            if (nameToValue.hasOwnProperty(part.name)) {
                                value = nameToValue[part.name];
                                addressStringParts.push(value);
                            }
                            vcard.ADR[type][part.name] = value;
                        }
                    }

                } else if (node.type === "date") {
                    vcard[node.name] = vCardUtil.getValue(vCardXML, node.name);
                } else if (node.type === "photo") {
                }

            }
            return vcard;
        },

        getContactsFromVCardGroup: function (vCardGroupXML, allowEMails, allowPhones) {
            var result = [],
                members,
                i;
            if (!vCardGroupXML) {
                return [];
            }
            if (allowEMails === undefined) {
                allowEMails = true;
            }
            if (allowPhones === undefined) {
                allowPhones = true;
            }
            members = vCardGroupXML.querySelectorAll("MEMBER");
            for (i = 0; i < members.length; i++) {
                var name = members[i].getAttribute("CN");
                var value = members[i].textContent;
                if (members[i].querySelector("VALUE")) {
                    value = members[i].querySelector("VALUE").textContent;
                }
                var isEMail = value.indexOf("@") > 0;
                if (isEMail && !allowEMails || !isEMail && !allowPhones) {
                    continue;
                }
                var numberTelephone = isEMail ? null : value.replace(/[^\d]/gi, "");
                result.push(
                    {
                        name: name || value,
                        email: value,
                        telephone: value,
                        value: value,
                        numberTelephone: numberTelephone ? value : null,
                        source: vCardGroupXML
                    });
            }
            return result;
        },

        clone: function (fromNode) {
            var xmlDoc = fromNode.ownerDocument,
                toNode,
                fromChildNodes,
                i;

            if (fromNode.tagName) {
                toNode = xmlDoc.createElement(fromNode.tagName);
                fromChildNodes = fromNode.childNodes;
                for (i = 0; i < fromChildNodes.length; i++) {
                    toNode.appendChild(vCardUtil.clone(fromChildNodes[i]));
                }
            } else {
                toNode = xmlDoc.createTextNode(fromNode.textContent);
            }
            return toNode;
        },

        merge: function (toVCardXML, fromVCardXML) {
            var changed = false,
                NON_MERGEABLE_NODES = [
                    "NOTE",
                    "UID",
                    "CATEGORIES"
                ],
                MULTIPLE_NODES = [
                    "EMAIL",
                    "TEL",
                    "ADR",
                    "LABEL",
                    "URL"
                ],
                OVERRIDE_NODES = [
                    "PHOTO",
                    "BDAY",
                    "TZ",
                    "TITLE",
                    "ROLE",
                    "ORG",
                    "KEY",
                    "X-PHOTO-HASH",
                    "N"
                ],
                nodes, i;

            if (!toVCardXML || !fromVCardXML) {
                return;
            }

            function removeEmptyNodes(nodes) {
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    var childNodes = node.childNodes;
                    if (childNodes.length === 0 ||
                        childNodes.length === 1 && node.querySelectorAll("VALUE").length === 1 && node.querySelector("VALUE").textContent === "") {
                        node.parentNode.removeChild(node);
                    }
                }
            }

            function containsSameNode(nodes, node) {
                var nodeValue, i, nodesNodeValue, nodesNodeText;
                var isTel = node.tagName === "TEL";
                if (node.querySelectorAll("VALUE").length === 1) {
                    nodeValue = node.querySelector("VALUE").textContent;
                    if (isTel) {
                        nodeValue = nodeValue.replace(/[^\d]/gi, "");
                    }
                    for (i = 0; i < nodes.length; i++) {
                        if (nodes[i].querySelector("VALUE")) {
                            nodesNodeValue = nodes[i].querySelector("VALUE").textContent;
                            if (isTel) {
                                nodesNodeValue = nodesNodeValue.replace(/[^\d]/gi, "");
                            }
                            if (nodesNodeValue.toLocaleLowerCase() === nodeValue.toLocaleLowerCase()) {
                                return true;
                            }
                        }
                    }
                } else if (node.tagName === "URL" && !node.querySelector("VALUE")) {
                    nodeValue = node.textContent;
                    for (i = 0; i < nodes.length; i++) {
                        if (nodes[i].querySelector("VALUE")) {
                            nodesNodeValue = nodes[i].querySelector("VALUE").textContent;
                            if (nodesNodeValue.toLocaleLowerCase() === nodeValue.toLocaleLowerCase()) {
                                return true;
                            }
                        }
                    }
                } else {
                    var nodeText = $(node).xml(true).toLocaleLowerCase();
                    for (i = 0; i < nodes.length; i++) {
                        nodesNodeText = $(nodes[i]).xml(true).toLocaleLowerCase();
                        if (nodeText === nodesNodeText) {
                            return true;
                        }
                    }
                }
                return false;
            }

            function mergeOneNode(toXML, fromRootNode) {
                var changed = false,
                    fromRootNodeName = fromRootNode.tagName,
                    sameNodes, sameNodesLength, oldNode;
                if (NON_MERGEABLE_NODES.indexOf(fromRootNodeName) >= 0) {
                    return false;
                }
                sameNodes = toXML.querySelectorAll(fromRootNodeName);
                removeEmptyNodes(sameNodes);
                sameNodesLength = sameNodes.length;
                if (sameNodesLength === 0) {
                    toXML.appendChild(vCardUtil.clone(fromRootNode));
                    changed = true;
                }
                else if (!containsSameNode(sameNodes, fromRootNode)) {
                    if (MULTIPLE_NODES.indexOf(fromRootNodeName) >= 0) {
                        toXML.appendChild(vCardUtil.clone(fromRootNode));
                        changed = true;
                    }
                    else if (OVERRIDE_NODES.indexOf(fromRootNodeName) >= 0) {
                        oldNode = toXML.querySelector(fromRootNodeName);
                        if (oldNode) {
                            toXML.removeChild(oldNode);
                        }
                        toXML.appendChild(vCardUtil.clone(fromRootNode));
                        changed = true;
                    }
                }
                return changed;
            }

            nodes = fromVCardXML.childNodes;
            for (i = 0; i < nodes.length; i++) {
                changed = mergeOneNode(toVCardXML, nodes[i]) || changed;
            }

            return changed;
        }


    };

    var Contact = function (folder, environment) {
        var self = this;
        this.folder = folder;
        this.name = "";
        this.UID = null;
        this.To = null;
        this.vCardJSON = {};
        this.emails = [];
        this.telnums = [];
        this.typedEmails = [];
        this.typedTelnums = [];
        this.addresses = [];
        this.vCardXML = null;
        this.vCardHash = undefined;
        this.photoData = null;
        this.peer = null;
        this.presenceArrived = false;
        this.presence = "offline";
        this.status = "";
        this.presenceHash = undefined;
        this.group = "";
        this.isGroup = false;
        this.vCardGroupXML = null;
        this.groupMembers = [];
        this.hasCertificate = false;
        this.nameIsCopiedFromEmail = false;

        this.on = {};

        function fillNameFromVCardXML() {
            var value = vCardUtil.getValue(self.vCardXML, "X-FILE-AS VALUE");
            if (value) {
                self.name = value;
                return;
            }
            value = vCardUtil.getValue(self.vCardXML, "NAME VALUE");
            if (value) {
                self.name = value;
                return;
            }

            if (vCardUtil.getValues(self.vCardXML, "EMAIL") !== null)
                value = vCardUtil.first(vCardUtil.getValues(self.vCardXML, "EMAIL"));
            if (value) {
                self.name = value;
                self.nameIsCopiedFromEmail = true;
                return;
            }
        }

        function fillEmailsFromVCardXML() {
            self.emails = crvCardUtil.getValues(self.vCardXML, "EMAIL");
            self.typedEmails = vCardUtil.getTypedValues(self.vCardXML, "EMAIL");
        }

        function fillTelnumsFromVCardXML() {
            self.telnums = vCardUtil.getValues(self.vCardXML, "TEL");
            self.typedTelnums = vCardUtil.getTypedValues(self.vCardXML, "TEL");
        }

        function fillAddressesFromVCardXML() {
            var addresses = [],
                nodes,
                i,
                node,
                addressParts;

            if (!self.vCardXML) {
                self.addresses = [];
                return;
            }
            nodes = self.vCardXML.querySelectorAll("ADR");
            for (i = 0; i < nodes.length; i++) {
                node = nodes[i].firstChild;
                if (node) {
                    node = node.nextSibling;
                }
                addressParts = [];
                while (node !== null) {
                    if (node.textContent) {
                        addressParts.push(node.textContent);
                    }
                    node = node.nextSibling;
                }
                addresses.push(addressParts.join(", "));
            }
            self.addresses = addresses;
        }

        function updatePhotoDataFromVCardXML(callback) {
            vCardUtil.getPhotoData(self.vCardXML, function (data) {
                self.photoData = data;
                callback();
            });
        }

        function updatePhotoDataFromURL() {
            var imgUrl = environment.getSessionURLBase() + "/MIME/" + encodeURIComponent(self.folder.name) + "/" + self.UID + "-V/PHOTO";
            PhotoUtil.getOptimizedPhotoData(imgUrl, true, function (data) {
                self.photoData = data;
            });
        }

        this.getFirstEmail = function () {
            return self.peer || (self.emails ? self.emails[0] : '');
        };

        this.getValue = function (nodeName) {
            return vCardUtil.getValue(self.vCardXML, nodeName);
        };

        this.getGroupValue = function (nodeName) {
            return vCardUtil.getValue(self.vCardGroupXML, nodeName);
        };

        this.updateFromVCard = function (callback) {
            self.vCardJSON = vCardUtil.getVCard(self.vCardXML);


            updatePhotoDataFromVCardXML(function () {
                if (callback) {
                    callback();
                }
            });
        };

        this.updateFromVCardGroup = function () {
            var emailContacts = vCardUtil.getContactsFromVCardGroup(self.vCardGroupXML, true, false),
                telnumContacts = vCardUtil.getContactsFromVCardGroup(self.vCardGroupXML, false, true);
            self.emails = [];
            self.typedEmails = [];
            emailContacts.forEach(function (contact) {
                var email = '"' + contact.name + '" <' + contact.email + '>';
                self.emails.push(email);
                self.typedEmails.push({type: "", value: email});
            });
            self.telnums = [];
            self.typedTelnums = [];
            telnumContacts.forEach(function (contact) {
                var telnum = '"' + contact.name + '" <' + contact.telephone + '>';
                self.telnums.push(telnum);
                self.typedTelnums.push({type: "", value: telnum});
            });

            self.groupMembers = vCardUtil.getContactsFromVCardGroup(self.vCardGroupXML, true, true);

            self.name = vCardUtil.getValue(self.vCardGroupXML, "NAME VALUE") ||
                vCardUtil.getValue(self.vCardGroupXML, "FN VALUE");
            if (!self.name && vCardUtil.getValues(self.vCardGroupXML, "EMAIL")) {
                self.name = vCardUtil.getValues(self.vCardGroupXML, "EMAIL")[0]
            }
            self.on.vCardUpdated.dispatch(self);
        };

        this.copyRosterPropsFromContact = function (contact) {
            self.peer = contact.peer;
            self.presence = contact.presence;
            self.status = contact.status;
            self.presenceArrived = contact.presenceArrived;
            self.presenceHash = contact.presenceHash;
        };

        this.getGroup = function () {
            if (self.presence === "offline") {
                return "offline";
            }
            return self.group;
        };

        this.getGroupLabel = function (strings) {
            if (self.presence === "offline") {
                return strings.getString("PresenceStates.offline");
            }
            return self.group || strings.getString("MyContacts");
        };

        this.update = function (xml, callback) {
            var $xml = $(xml), xmlName = $xml.prop("tagName"),
                hashXml, emails = [], typedEmails = [], name, peer, vCardXML, newIMGroup = "";

            if (xmlName === "rosterItem") {
                self.name = !$xml.attr("name") ? $xml.attr("peer") : $xml.attr("name");
                self.peer = $xml.attr("peer");
                $xml.find("group").each(function (i, el) {
                    var value = $(el).text();
                    if (value && value.charAt(0) !== "~") {
                        newIMGroup = value;
                        return;
                    }
                });
                self.group = newIMGroup;
            } else if (xmlName === "presence") {
                self.peer = $xml.attr("peer");
                self.presenceArrived = true;
                self.presence = ($xml.attr("type") === "unavailable" || !$xml.find("presence").text()) ? "offline" : $xml.find("presence").text().toLowerCase();
                self.status = $xml.find("status").text();
                hashXml = $xml.find('x[xmlns="jabber:iq:avatar"]>hash');
                if (hashXml.size() > 0) {
                    self.presenceHash = hashXml.text();
                } else {
                    hashXml = $xml.find('x[xmlns="vcard-temp:x:update"]>photo');
                    if (hashXml.size() > 0) {
                        self.presenceHash = hashXml.text();
                    }
                }
            } else if (xmlName === "folderReport") {
                self.UID = $xml.attr("UID");
                if ($xml.find("E-To").text() === "GROUP") {
                    self.isGroup = true;
                } else {
                    $xml.find("E-To").each(function (i, el) {
                        var value = $(el).text();
                        emails.push(value);
                        typedEmails.push({type: $(el).attr("realName") || "home", value: value});
                    });
                    self.emails = emails;
                    self.typedEmails = typedEmails;
                }
                name = $xml.find("Subject").text();
                self.name = !name ? self.getFirstEmail() : name;
                updatePhotoDataFromURL();
            } else if (xmlName === "folderMessage") {
                self.UID = $xml.attr("UID");
                if ($xml.attr("X-Has-Certificate")) {
                    self.hasCertificate = true;
                }
                if ($xml.find("Email>To").text() === "GROUP") {
                    self.isGroup = true;
                }
                if (!self.isGroup) {
                    self.vCardXML = $xml.find("vCard").get(0);
                    self.vCardHash = vCardUtil.getValue(self.vCardXML, "X-PHOTO-HASH VALUE") || "";
                    self.updateFromVCard(callback);
                } else {
                    self.vCardGroupXML = $xml.find("vCardGroup").get(0);
                    self.updateFromVCardGroup();
                    if (callback) {
                        callback();
                    }
                }
            } else if (xmlName === "iqRead") {
                peer = $xml.attr("peer");
                self.needIq = false;
                if (!self.UID) {
                    self.UID = 0;
                }
                vCardXML = $xml.find("vCard").get(0);
                if (vCardXML && $(vCardXML).children().size() > 0) {

                    vCardXML = vCardUtil.clone(vCardXML);

                    emails = vCardUtil.getValues(vCardXML, "EMAIL");
                    if (emails.indexOf(peer) === -1) {
                        vCardUtil.appendMultiValue(vCardXML, "EMAIL VALUE", peer);
                    }

                    self.vCardHash = self.presenceHash;
                    if (self.vCardHash !== undefined) {
                        vCardUtil.setValue(vCardXML, "X-PHOTO-HASH VALUE", self.vCardHash);
                    }
                } else {
                    vCardXML = xml.ownerDocument.createElement("vCard");
                    vCardUtil.setValue(vCardXML, "X-FILE-AS VALUE", !self.name ? peer : self.name);
                    vCardUtil.appendMultiValue(vCardXML, "EMAIL VALUE", peer);
                }
                if (self.vCardXML) {
                    vCardUtil.merge(self.vCardXML, vCardXML);
                } else {
                    self.vCardXML = vCardXML;
                }
                self.updateFromVCard(callback);
            }
            if ($('X-Has-Certificate', $xml).text()) {
                self.hasCertificate = true;
            }
        };
    };


    var ximss = {

        onXimssReadIM: function (peer, peerName, msgTxt) {
        },
        onXimssReadIMComposing: function (peer, peerName) {
        },
        onXimssReadIMGone: function (peer, peerName) {
        },
        onXimssCallProvisioned: function (callId) {
        },
        onXimssCallConnected: function (callId, withVideo) {
        },
        onXimssCallDisconnected: function (errorText) {
        },
        onXimssOnHold: function (isHold, status) {
        },
        onXimssSuccessLogin: function () {
        },
        onXimssErrorLogin: function (errorText) {
        },
        onXimsError: function (errorText) {
        },
        onXimssCallIncoming: function (peer, peerName, isVideo, cid) {
        },
        onStatistic: function (stat) {
        },
        onXimssCallAccept: function () {
        },
        onXimssCallUpdateAccept: function () {
        },
        onXimssSignalBind: function () {
        },
        onXimssPresence: function (peer, show, presence) {
        },
        onXimssRosterItem: function (peerName, peer, group, subscription) {
        },
        onMeetingNotFound: function () {
        },
        onMeetingFound: function (taskRef) {
        },
        onConflict: function () {
        },
        onNetworkError: function (isFatal, timeElapsed) {
        },
        onNetworkOk: function () {
        },
        onXimssSignalBindForDevice: function () {
        },
        onXimssMakeCallReport: function (reportText) {
        },
        onXimssCallUpdated: function (isHold, callId) {
        },
        onXimssCallUpdatedError: function (isHold, callId, signalCode, errorText) {
        },
        onXimssCallOpCompleted: function (callId) {
        },
        onXimssCallOpFailed: function (errorText, signalCode, callId) {
        },
        onXimssCallTransfer: function () {
        },
        onXimssFileWrite: function () {
        },
        onIqRead: function (peer, vCardJSON, photoData) {
        },
        onXimssContact: function (abook, xmlVCard) {
        },
        onXimssContact2: function (abook, peerContact, toFields, xAgent, xWork, xLastName, xFirstName, MessageID, xDate) {
        },
        onXimssContactRemoved: function (folder, uid) {
        },
        onXimssVCardUploaded: function (uploadId) {
        },
        onXimssPrefs: function (prefsXML) {
        },
        onXimssPrefsCustom: function (answer) {
        },
        onXimssFileData: function (type, fileName, fileData) {
        },
        onXimssMyContact: function (type, fileName, myContact) {
        },
        onXimssVoiceFile: function (url, UID, From, Date) {
        },
        onXimssVoiceMessages: function (messages, unseen) {
        },
        onXimssVoiceMailFlags: function (uid, flags) {
        },
        onXimssRecoverPassword: function (errorText) {
        },
        onXimssRights: function (mailbox) {
        },
        onMailboxSubscription: function (mailbox) {
        },

        onCgCardEvent: function (xmlEvent) {
        },
        onGroupsInfoEvent: function (xmlEvent) {
        },
        onGroupsListEvent: function (xmlData) {
        },
        onStatusEvent: function (xmlData) {
        },
        onCrmLinkEvent: function (linkString, origLink) {
        },
        onXimssReceiveCgCardId: function (peer, peerName, cardid) {
        },
        onXimssReceiveCRMlink: function (peer, peerName, link, origLink) {
        },
        onXimssBanner: function (xmlResponse) {
        },
        onUserMediaError: function (errorMessage) {
        },
        onUserMediaSuccess: function () {
        },
        onFileNotFound: function (fileName) {
        },
        onvCardFail: function () {
        },
        onMailBoxAccessError: function () {
        },
        onXimssCliResult: function (cliResult) {
        },
        onXimssSessionID: function (sID) {
        },
        onXimssClosed: function () {
        },
        onXimssForceClosed: function () {
        },
        onXimssContactsInfo: function (folder, messages) {
        },
        onXimssFileList: function (fileName, size, timeModified, directory) {
        },
        onXimssUpdateContext: function () {
        },
        onIntegration: function (integration) {
        },
        onNewCGCard: function (xmlData) {
        },
        onAutoCall: function (phone, line) {
        },
        onDisplayEvent: function (realName, groupName, phone) {
        },
        onWelcome: function () {
        },
        onPMOfind: function () {
        },
        onXimssTaskSendEvent: function(eventName){
        },

        pc: null,
        logined: false,
        taskReferer: null,
        hubTaskReferer: null,
        conflict: false,
        isHold: false,
        urlID: null,
        domainName: null,
        serverName: null,
        userName: null,
        callLegs: [],
        currentCalls: [],
        closeTimeout: null,
        audioIn: null,
        isVideo: false,
        rejectId: null,
        incomingWithVideo: false,
        isPresence: true,
        localVideoStream: null,
        CGPversion: null,
        audioDevices: new Array(),
        videoDevices: new Array(),
        isSdpText: false,
        xmlSdp: "sdp",
        widget: false,

        ifFirefox: navigator.userAgent.toLowerCase().indexOf('firefox') > -1,

        ximssErr: function (errStr) {
            if (DEBUG_SIPNET === true) console.log("ximssErr():", errStr);
            if (this.onXimssError) this.onXimssError(errStr);
        },


        initRTC: function (callid, audioIn) {

            if (DEBUG_SIPNET === true) console.log("Start call with device: " + audioIn);

            this.audioIn = audioIn;

            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            if (!this.videoDevices || !this.videoDevices.length || this.userStatus === 'admin' || this.userStatus === 'widget') {
                this.isVideo = false;
            }


            var self = this;

            navigator.getUserMedia({audio: {optional: [{sourceId: this.audioIn}]}, video: this.isVideo},
                function (stream) {
                    if (self.currentCalls[callid] === undefined || self.currentCalls === undefined) return;
                    self.onUserMediaSuccess();
                    self.currentCalls[callid]['localStream'] = stream;
                    self.initPeerConnection(callid);
                },
                function (errObj) {
                    var message = '';
                    switch (errObj.name) {
                        case 'NotFoundError':
                        case 'DevicesNotFoundError':
                            message = 'Please setup your microphone.';
                            break;
                        case 'SourceUnavailableError':
                            message = 'Your microphone is busy.';
                            break;
                        case 'PermissionDeniedError':
                        case 'SecurityError':
                            message = 'Microphone access permission denied.';
                            break;
                        default:
                            message = 'Something wrong with media devices.';
                    }

                    self.onUserMediaError(message);

                }
            );
            return true;
        },


        initPeerConnection: function (callid) {

            if (this.currentCalls[callid]['pc'] !== null) {
                this.unsubscribePC(this.currentCalls[callid]['pc']);
                this.currentCalls[callid]['pc'].close();
                this.currentCalls[callid]['pc'] = null;
            }

            this.currentCalls[callid]['pc'] = new RTCPeerConnection(configuration, {'mandatory': {'DtlsSrtpKeyAgreement': 'true'}});


            var self = this;

            this.currentCalls[callid]['pc'].oniceconnectionstatechange = function (event) {
                if (DEBUG_SIPNET === true) console.log('iceConnectionState: ' + self.currentCalls[callid]['pc'].iceConnectionState);
                if (self.currentCalls[callid]['pc'].iceConnectionState === "failed" ||
                    self.currentCalls[callid]['pc'].iceConnectionState === "disconnected" ||
                    self.currentCalls[callid]['pc'].iceConnectionState === "closed") {

                }
            };

            this.currentCalls[callid]['pc'].onicegatheringstatechange = function () {

                if (self.currentCalls[callid]['pc']!==null)
                    if (DEBUG_SIPNET === true)
                        console.log('onicegatheringstatechange: ' + self.currentCalls[callid]['pc'].iceGatheringState);

                //после сбора ICE запускаем и обнуляем таймер если он не отработал раньше
                if (self.currentCalls[callid]['pc'].iceGatheringState === "complete") {
                    if (self.startCallTimer!==null) {
                        if (DEBUG_SIPNET === true) console.log("ICE complete, try to start call...");
                        clearTimeout(self.startCallTimer);
                        self.startCallTimer = null;
                        if (DEBUG_SIPNET === true) console.log("clear startCallTimer on complete");
                        self.callStart();
                    }else{
                        if (DEBUG_SIPNET === true)  console.log("May be first timer is work, not calling...");
                    }
                }

                if (DEBUG_SIPNET === true) console.log('onicegatheringstatechange: ' + self.currentCalls[callid]['pc'].iceGatheringState);
            }


            this.currentCalls[callid]['pc'].onicecandidate = function (event) {
                if (!event.candidate) {
                    if (DEBUG_SIPNET === true) console.log('Candidate: ' + event.candidate);
                    if (DEBUG_SIPNET === true) console.log(self);
                }
            };

            this.currentCalls[callid]['pc'].addStream(this.currentCalls[callid]['localStream']);

            this.currentCalls[callid]['pc'].createOffer(
                function (desc) {
                    if (DEBUG_SIPNET === true) console.log("createOffer_success(): \ndesc.sdp:\n" + desc.sdp + "desc:", desc);
                    self.currentCalls[callid]['pc'].setLocalDescription(desc,
                        function () {
                            if (DEBUG_SIPNET === true) console.log("Success setLocalDescription2222");

                            self.startCallTimer=setTimeout(function(){
                                if (self.startCallTimer!==null) {
                                    if (DEBUG_SIPNET === true) console.log("ICE timeout, try to start call...");
                                    self.startCallTimer = null;
                                    self.callStart();
                                }
                            }, 1000);

                        },
                        function (errObj) {
                            if (DEBUG_SIPNET === true) console.log("UnSuccess setLocalDescription");
                            self.ximssErr('Error create local SDP:' + JSON.stringify(errObj, null, ' '));
                        }
                    );
                },
                function (err) {
                    if (DEBUG_SIPNET === true) console.log("createOffer_error():", err);
                },
                {}
            );

            this.callStart=()=>{
                if (self.theSession !== null) {

                    var callLeg = "leg_" + self.callLegCount++;

                    self.currentCalls[callid]['callLeg'] = callLeg;
                    self.currentCalls[callid]['isHold'] = false;


                    var startCallRequest = self.theSession.createXMLNode("callStart");
                    startCallRequest.setAttribute("peer", self.currentCalls[callid]['peer']);
                    startCallRequest.setAttribute("callLeg", self.currentCalls[callid]['callLeg']);
                    startCallRequest.setAttribute("media", "WebRTC");

                    var sdpXml = self.theSession.createXMLNode(self.xmlSdp);

                    if (self.isSdpText === false) {
                        var docXML = (new DOMParser()).parseFromString("<root/>", "text/xml");
                        sdpXml = SDPXML.parseText(self.fixIpV6SDP(self.currentCalls[callid]['pc'].localDescription.sdp), docXML);
                        SDPXML.adjustWebRTCXML(sdpXml, null);
                    } else {
                        sdpXml.appendChild(self.theSession.createTextNode(self.fixOutSDP(self.currentCalls[callid]['pc'].localDescription.sdp)));
                    }


                    startCallRequest.appendChild(sdpXml);
                    self.theSession.sendRequest(startCallRequest, ximssSession, self.ximssDataCallback, self.ximssOpCompleted, true);
                }
            }

        },




        initRTCAnswer: function (callid, audioIn, isVideo) {

            if (DEBUG_SIPNET === true) console.log("Answer with device: " + audioIn);

            this.audioIn = audioIn;

            this.isVideo = isVideo === true;

            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;


            if (!this.videoDevices || !this.videoDevices.length || this.userStatus === 'admin' || this.userStatus === 'widget') {
                this.isVideo = false;
            }

            var self = this;

            navigator.getUserMedia({audio: {optional: [{sourceId: this.audioIn}]}, video: this.isVideo},
                function (stream) {
                    if (self.currentCalls[callid] === undefined || self.currentCalls === undefined) return;
                    self.onUserMediaSuccess();
                    var e = document.getElementById('audioElem_' + callid);

                    e.srcObject = stream;

                    self.currentCalls[callid]['localStream'] = stream;
                    self.initPeerConnectionAnswer(callid);

                    if (self.onXimssCallAccept) self.onXimssCallAccept(callid);
                },
                function (errObj) {
                    var message = '';
                    switch (errObj.name) {
                        case 'NotFoundError':
                        case 'DevicesNotFoundError':
                            message = 'Please setup your microphone.';
                            break;
                        case 'SourceUnavailableError':
                            message = 'Your microphone is busy.';
                            break;
                        case 'PermissionDeniedError':
                        case 'SecurityError':
                            message = 'Microphone access permission denied.';
                            break;
                        default:
                            message = 'Something wrong with media devices.';
                    }

                    self.ximssCallReject(1);
                    self.onUserMediaError(message);

                }
            );
            return true;
        },


        initPeerConnectionAnswer: function (callid) {

            if (this.currentCalls[callid]['pc'] !== null) {
                this.unsubscribePC(this.currentCalls[callid]['pc']);
                this.currentCalls[callid]['pc'].close();
                this.currentCalls[callid]['pc'] = null;
            }


            this.currentCalls[callid]['pc'] = new RTCPeerConnection(configuration, {'mandatory': {'DtlsSrtpKeyAgreement': 'true'}});
            var self = this;
            this.currentCalls[callid]['pc'].onicegatheringstatechange = function () {

                if (self.currentCalls[callid] === undefined || self.currentCalls === undefined) return;

                if (self.currentCalls[callid]['pc'] !== null)
                    if (DEBUG_SIPNET === true)
                        console.log('onicegatheringstatechange: ' + self.currentCalls[callid]['pc'].iceGatheringState);


                //после сбора ICE запускаем и обнуляем таймер если он не отработал раньше
                if (self.currentCalls[callid]['pc'].iceGatheringState === "complete") {
                    if (self.answerCallTimer!==null) {
                        if (DEBUG_SIPNET === true) console.log("ICE complete, try to answer call...");
                        clearTimeout(self.answerCallTimer);
                        self.answerCallTimer = null;
                        if (DEBUG_SIPNET === true) console.log("clear answerCallTimer on complete");
                        self.callAnswer();
                    }else{
                        if (DEBUG_SIPNET === true) console.log("May be first timer is work, not calling...");
                    }
                }
            }


            this.currentCalls[callid]['pc'].onicecandidate = function (event) {
                if (!event.candidate) {

                }
            };


            this.currentCalls[callid]['pc'].onaddstream = function (event) {

                var e = document.getElementById("audioElem_" + callid);
                e.srcObject = event.stream;
            };


            this.currentCalls[callid]['pc'].addStream(this.currentCalls[callid]['localStream']);

            if (this.currentCalls[callid]['remoteSDP'] !== null) {

                var desc = null;
                var compare = this.versionCompare(this.CGPversion, '6.2.0');

                if (self.isSdpText === false && compare > 0) {
                    desc = (new RTCSessionDescription({
                        type: "offer",
                        sdp: this.currentCalls[callid]['remoteSDP']
                    }));
                } else {
                    desc = (new RTCSessionDescription({
                        type: "offer",
                        sdp: this.fixCGSDPStrso(this.currentCalls[callid]['remoteSDP'], "offer")
                    }));
                }

                if (DEBUG_SIPNET === true) console.log("IncomingCall(): \ndesc.sdp:\n" + desc.sdp + "desc:", desc);

                this.currentCalls[callid]['pc'].setRemoteDescription(desc,
                    function () {
                        self.currentCalls[callid]['pc'].createAnswer(
                            function (desc) {
                                if (DEBUG_SIPNET === true) console.log("createAnswer_success(): \ndesc.sdp:\n" + desc.sdp + "desc:", desc);

                                self.currentCalls[callid]['pc'].setLocalDescription(desc,
                                    function () {

                                        self.answerCallTimer=setTimeout(function(){
                                            if (self.answerCallTimer!==null) {
                                                if (DEBUG_SIPNET === true) console.log("ICE timeout, try to answer call...");
                                                self.answerCallTimer = null;
                                                self.callAnswer();
                                            }
                                        }, 1000);

                                    },

                                    function (errObj) {
                                        if (DEBUG_SIPNET === true) console.log("UnSuccess setLocalDescription");
                                        self.ximssErr('Error create local SDP:' + JSON.stringify(errObj, null, ' '));
                                    }
                                );
                            },

                            function (err) {
                                if (DEBUG_SIPNET === true) console.log("createAnswer_error():", err);
                            },
                            {}
                        );

                    },

                    function (errObj) {
                        if (DEBUG_SIPNET === true) console.log("UnSuccess setRemoteDescription");
                    }
                );
            } else {
                this.currentCalls[callid]['pc'].createOffer(
                    function (desc) {
                        if (DEBUG_SIPNET === true) console.log("createOffer_success(): \ndesc.sdp:\n" + desc.sdp + "desc:", desc);
                        self.currentCalls[callid]['pc'].setLocalDescription(desc,
                            function () {
                                if (DEBUG_SIPNET === true) console.log("Success setLocalDescription2222");

                                self.answerCallTimer=setTimeout(function(){
                                    if (self.answerCallTimer!==null) {
                                        if (DEBUG_SIPNET === true) console.log("ICE timeout, try to answer call...");
                                        self.answerCallTimer = null;
                                        self.callAnswer();
                                    }
                                }, 1000);

                            },
                            function (errObj) {
                                if (DEBUG_SIPNET === true) console.log("UnSuccess setLocalDescription");
                                self.ximssErr('Error create local SDP:' + JSON.stringify(errObj, null, ' '));
                            }
                        );
                    },
                    function (err) {
                        if (DEBUG_SIPNET === true) console.log("createOffer_error():", err);
                    },
                    {}
                );
            }

            this.callAnswer=()=> {
                if (self.theSession !== null) {
                    var callAcceptResponse = self.theSession.createXMLNode("callAccept");
                    callAcceptResponse.setAttribute("callLeg", self.currentCalls[callid]['callLeg']);

                    var sdpXml = self.theSession.createXMLNode(self.xmlSdp);

                    if (self.isSdpText === false) {
                        var docXML = (new DOMParser()).parseFromString("<root/>", "text/xml");
                        sdpXml = SDPXML.parseText(self.currentCalls[callid]['pc'].localDescription.sdp, docXML);

                        SDPXML.adjustWebRTCXML(sdpXml, null);
                    } else {
                        sdpXml.appendChild(self.theSession.createTextNode(self.fixOutSDP(self.currentCalls[callid]['pc'].localDescription.sdp)));
                    }

                    callAcceptResponse.appendChild(sdpXml);
                    self.theSession.sendRequest(callAcceptResponse, ximssSession, self.ximssDataCallback, self.ximssOpCompleted, true);
                }
            }

        },


        doUpdateRequestAccept: function (callid, requestType) {

            if (this.currentCalls[callid]['pc'] !== null) {
                this.unsubscribePC(this.currentCalls[callid]['pc']);
                this.currentCalls[callid]['pc'].close();
                this.currentCalls[callid]['pc'] = null;
            }

            this.currentCalls[callid]['pc'] = new RTCPeerConnection(configuration, {'mandatory': {'DtlsSrtpKeyAgreement': 'true'}});

            var self = this;

            this.currentCalls[callid]['pc'].onicegatheringstatechange = function () {

                if (self.currentCalls[callid] === undefined || self.currentCalls === undefined) return;

                if (self.currentCalls[callid]['pc'] !== null)
                    if (DEBUG_SIPNET === true)
                        console.log('onicegatheringstatechange: ' + self.currentCalls[callid]['pc'].iceGatheringState);

                //после сбора ICE запускаем и обнуляем таймер если он не отработал раньше
                if (self.currentCalls[callid]['pc'].iceGatheringState === "complete") {
                    if (self.updateAcceptTimer!==null) {
                        if (DEBUG_SIPNET === true) console.log("ICE complete, try to update accept...");
                        clearTimeout(self.updateAcceptTimer);
                        self.updateAcceptTimer = null;
                        if (DEBUG_SIPNET === true) console.log("clear updateAcceptTimer on complete");
                        self.callUpdateAccept();
                    }else{
                        if (DEBUG_SIPNET === true) console.log("May be first timer is work, not calling...");
                    }
                }

            };


            this.currentCalls[callid]['pc'].onicecandidate = function (event) {
                if (!event.candidate) {
                }
            };


            this.currentCalls[callid]['pc'].onaddstream = function (event) {
                var e = document.getElementById('audioElem_' + callid);
                e.srcObject = event.stream;
            };


            this.currentCalls[callid]['pc'].addStream(this.currentCalls[callid]['localStream']);

            var desc;

            var compare = this.versionCompare(this.CGPversion, '6.2.0');

            if (self.isSdpText === false && compare > 0) {
                desc = (new RTCSessionDescription({
                    type: requestType,
                    sdp: this.currentCalls[callid]['remoteSDP']
                }));
            } else {
                desc = (new RTCSessionDescription({
                    type: requestType,
                    sdp: this.fixCGSDPStrso(this.currentCalls[callid]['remoteSDP'], requestType)
                }));
            }

            if (DEBUG_SIPNET === true) console.log("doUpdateRequestAccept(): \ndesc.sdp:\n" + desc.sdp + "desc:", desc);

            this.currentCalls[callid]['pc'].setRemoteDescription(desc,
                function () {
                    self.currentCalls[callid]['pc'].createAnswer(
                        function (desc) {

                            self.currentCalls[callid]['pc'].setLocalDescription(desc,
                                function () {

                                    self.updateAcceptTimer=setTimeout(function(){
                                        if (self.updateAcceptTimer!==null) {
                                            if (DEBUG_SIPNET === true) console.log("ICE timeout, try to update accept...");
                                            self.updateAcceptTimer = null;
                                            self.callUpdateAccept();
                                        }
                                    }, 1000);
                                },

                                function (errObj) {
                                    if (DEBUG_SIPNET === true) console.log("UnSuccess setLocalDescription");
                                    this.ximssErr('Error create local SDP:' + JSON.stringify(errObj, null, ' '));
                                }
                            );
                        },

                        function (err) {
                            if (DEBUG_SIPNET === true) console.log("createNaswer_error():", err);
                        },
                        {}
                    );

                },

                function (errObj) {
                    if (DEBUG_SIPNET === true) console.log("UnSuccess setRemoteDescription");
                    self.doCallUpdateReject(callid, '488');
                }
            );

            this.callUpdateAccept=()=> {
                if (self.theSession !== null) {
                    var callUpdateAccept = self.theSession.createXMLNode("callUpdateAccept");
                    callUpdateAccept.setAttribute("callLeg", self.currentCalls[callid]['callLeg']);
                    callUpdateAccept.setAttribute("media", "WebRTC");
                    var sdpXml = self.theSession.createXMLNode(self.xmlSdp);


                    if (self.isSdpText === false) {
                        var docXML = (new DOMParser()).parseFromString("<root/>", "text/xml");
                        sdpXml = SDPXML.parseText(self.currentCalls[callid]['pc'].localDescription.sdp, docXML);
                        SDPXML.adjustWebRTCXML(sdpXml, null);
                    } else {
                        sdpXml.appendChild(self.theSession.createTextNode(self.fixOutSDP(self.currentCalls[callid]['pc'].localDescription.sdp, true)));
                    }

                    callUpdateAccept.appendChild(sdpXml);
                    self.theSession.sendRequest(callUpdateAccept, ximssSession, self.ximssDataCallback, self.ximssOpCompleted, true);
                }
            }

        },

        fixIpV6SDP: function (srcSDP) {
            return srcSDP;
        },

        fixOutSDP: function (srcSDP) {

            if (DEBUG_SIPNET === true) console.log('fixOutSDP: ',srcSDP);

            srcSDP = srcSDP.replace(/\r/g, '');

            var compare = this.versionCompare(this.CGPversion, '16.2');

            srcSDP = srcSDP.replace(/UDP\/TLS\/RTP\/SAVPF /g, 'RTP/SAVPF ');

            var detectorInfo = null;
            try {
                detectorInfo = detector;
            } catch (e) {
                if (DEBUG_SIPNET === true) console.log("No detector found!");
            }

            if (detectorInfo !== null) {
                var k = srcSDP.indexOf('m=audio'),
                    srcSDP = srcSDP.substring(0, k) + 'a=webrtc:' + detectorInfo["os"] + ' ' + detectorInfo["os_version"] + ' ' + detectorInfo["os_platform"] + ' ' + detectorInfo["client"] + ' ' + detectorInfo["client_name"] + ' ' + detectorInfo["client_version"] + ' ' + detectorInfo["device_brand"] + ' ' + detectorInfo["device_model"] + ' ' + detectorInfo["display"] + '\n' + srcSDP.substring(k);
            }
            return srcSDP;
        },


        fixOutSDPhold: function (srcSDP, hold) {
            srcSDP = srcSDP.replace(/\r/g, '');

            var detectorInfo = null;
            try {
                detectorInfo = detector;
            } catch (e) {
                if (DEBUG_SIPNET === true) console.log("No detector found!");
            }

            if (detectorInfo !== null) {
                var k = srcSDP.indexOf('m=audio'),
                    srcSDP = srcSDP.substring(0, k) + 'a=webrtc:' + detectorInfo["os"] + ' ' + detectorInfo["os_version"] + ' ' + detectorInfo["os_platform"] + ' ' + detectorInfo["client"] + ' ' + detectorInfo["client_name"] + ' ' + detectorInfo["client_version"] + ' ' + detectorInfo["device_brand"] + ' ' + detectorInfo["device_model"] + ' ' + detectorInfo["display"] + '\n' + srcSDP.substring(k);
            }
            return srcSDP;
        },


        fixCGSDPStr: function (srcSDP) {
            srcSDP = srcSDP.replace(/\r/g, '');

            var compare = this.versionCompare(this.CGPversion, '16.2');

            if (compare < 0) {
                if (DEBUG_SIPNET === true) console.log('current version is older than 6.2!');

                var j, i = srcSDP.indexOf('a=');
                var ip_, port_;
                while (i >= 0) {
                    if (srcSDP.charAt(i - 1) !== '\n') srcSDP = srcSDP.substring(0, i) + '\n' + srcSDP.substring(i);
                    i = srcSDP.indexOf('a=', i + 3);
                }
                if (srcSDP.charAt(srcSDP.length - 1) !== '\n') srcSDP += '\n';

                if (srcSDP.indexOf('c=IN IP6 ') > -1) {
                    i = srcSDP.indexOf('c=IN IP6 ') + 9;
                } else {
                    i = srcSDP.indexOf('c=IN IP4 ') + 9;
                }

                j = srcSDP.indexOf('\n', i);
                ip_ = srcSDP.substring(i, j);

                i = srcSDP.indexOf('m=audio ') + 8;
                j = srcSDP.indexOf(' ', i);

                port_ = srcSDP.substring(i, j);

                var z = srcSDP.indexOf('m=video');
                if (z !== -1) {
                    i = srcSDP.indexOf('m=video ') + 8;
                    j = srcSDP.indexOf(' ', i);
                    var port_v = srcSDP.substring(i, j);

                    srcSDP = srcSDP.replace('m=video', 'a=candidate:7777777 1 UDP 77 ' + ip_ + ' ' + port_ + ' typ host\nm=video');
                    srcSDP += 'a=candidate:7777777 1 UDP 77 ' + ip_ + ' ' + port_v + ' typ host\n';
                } else {
                    srcSDP += 'a=candidate:7777777 1 UDP 77 ' + ip_ + ' ' + port_ + ' typ host\n';
                }


            } else {
                if (DEBUG_SIPNET === true) console.log('current version is 6.2 or higher!');
            }


            srcSDP = srcSDP.replace(/RTP\/SAVPF /g, 'UDP/TLS/RTP/SAVPF ');
            srcSDP = srcSDP.replace(/RTP\/SAVP /g, 'UDP/TLS/RTP/SAVPF ');
            srcSDP = srcSDP.replace(/RTP\/AVP /g, 'UDP/TLS/RTP/SAVPF ');

            var isRtcpMux = srcSDP.indexOf('a=rtcp-mux');
            if(isRtcpMux < 0) {
                srcSDP = srcSDP.replace(/a=setup/g, 'a=rtcp-mux\na=setup');
            }
            return srcSDP;
        },


        fixCGSDPStrso: function (srcSDP, requestType) {
            srcSDP = srcSDP.replace(/\r/g, '');

            var compare = this.versionCompare(this.CGPversion, '16.2');

            if (compare < 0) {
                if (DEBUG_SIPNET === true) console.log('current version is older than 6.2!');

                var j, i = srcSDP.indexOf('a=');
                var ip_, port_;
                while (i >= 0) {
                    if (srcSDP.charAt(i - 1) !== '\n') srcSDP = srcSDP.substring(0, i) + '\n' + srcSDP.substring(i);
                    i = srcSDP.indexOf('a=', i + 3);
                }
                if (srcSDP.charAt(srcSDP.length - 1) !== '\n') srcSDP += '\n';


                if (srcSDP.indexOf('c=IN IP6 ') > -1) {
                    i = srcSDP.indexOf('c=IN IP6 ') + 9;
                } else {
                    i = srcSDP.indexOf('c=IN IP4 ') + 9;
                }


                j = srcSDP.indexOf('\n', i);
                ip_ = srcSDP.substring(i, j);

                i = srcSDP.indexOf('m=audio ') + 8;
                j = srcSDP.indexOf(' ', i);

                port_ = srcSDP.substring(i, j);

                i = srcSDP.indexOf('m=video ') + 8;
                j = srcSDP.indexOf(' ', i);

                var z = srcSDP.indexOf('m=video');
                if (z !== -1) {
                    i = srcSDP.indexOf('m=video ') + 8;
                    j = srcSDP.indexOf(' ', i);
                    var port_v = srcSDP.substring(i, j);

                    srcSDP = srcSDP.replace('m=video', 'a=candidate:7777777 1 UDP 77 ' + ip_ + ' ' + port_ + ' typ host\nm=video');
                    srcSDP += 'a=candidate:7777777 1 UDP 77 ' + ip_ + ' ' + port_v + ' typ host\n';
                } else {
                    srcSDP += 'a=candidate:7777777 1 UDP 77 ' + ip_ + ' ' + port_ + ' typ host\n';
                }

                if (requestType === "offer") {
                    srcSDP = srcSDP.replace('a=setup:active', 'a=setup:actpass');
                }
                if (requestType === "answer") {
                    srcSDP = srcSDP.replace('a=setup:actpass', 'a=setup:active');
                }

            } else {
                if (DEBUG_SIPNET === true) console.log('current version is 6.2 or higher!');
            }

            srcSDP = srcSDP.replace(/a=crypto.*\n/g, '');

            srcSDP = srcSDP.replace(/RTP\/SAVPF /g, 'UDP/TLS/RTP/SAVPF ');
            srcSDP = srcSDP.replace(/RTP\/SAVP /g, 'UDP/TLS/RTP/SAVPF ');
            srcSDP = srcSDP.replace(/RTP\/AVP /g, 'UDP/TLS/RTP/SAVPF ');


            return srcSDP;
        },

        getStats: function (peer) {
            var self = this;
            this.myGetStats(peer, function (results) {
                for (var i = 0; i < results.length; ++i) {
                    var res = results[i];
                    if (self.onXimssCallConnected) self.onStatistic(res);

                }

                setTimeout(function () {
                    self.getStats(peer);
                }, 100);
            });
        },

        myGetStats: function (peer, callback) {
            if (this.pc === null) return;
            if (!!navigator.mozGetUserMedia) {
                this.pc.getStats(
                    function (res) {
                        var items = [];
                        res.forEach(function (result) {
                            items.push(result);
                        });
                        callback(items);
                    },
                    callback);
            } else {

                this.pc.getStats(function (res) {
                    var items = [];
                    res.result().forEach(function (result) {
                        var item = {};
                        result.names().forEach(function (name) {
                            item[name] = result.stat(name);
                        });
                        item.id = result.id;
                        item.type = result.type;
                        item.timestamp = result.timestamp;
                        items.push(item);
                    });
                    callback(items);
                });
            }
        },

        remoteSDPRecived: function (remoteSDP, callid) {
            this.currentCalls[callid]['remoteSDP'] = remoteSDP;
            this.currentCalls[callid]['pc'].onaddstream = function (event) {
                var e = document.getElementById('audioElem_' + callid);

                e.srcObject = event.stream;

            };
            if (DEBUG_SIPNET === true) console.log("remoteSDP=" + remoteSDP);

            var desc = "";
            if (this.isSdpText === true) {
                desc = (new RTCSessionDescription({type: "answer", sdp: this.fixCGSDPStr(remoteSDP)}));
                if (DEBUG_SIPNET === true) console.log("fixedSDP=" + desc.sdp);
            } else {
                desc = (new RTCSessionDescription({type: "answer", sdp: remoteSDP}));
            }

            this.currentCalls[callid]['pc'].setRemoteDescription(desc,
                function () {
                    if (DEBUG_SIPNET === true) console.log("Success setRemoteDescription");
                },
                function (errObj) {
                    if (DEBUG_SIPNET === true) console.log("UnSuccess setRemoteDescription");

                }
            );
        },

        curCallLeg: "",
        callLegCount: 1,
        userStatus: 'agent',
        adminKey: '',

        doLogin: function (userName, passWord, domain, isSid, isAdmin, isWidget) {

            this.checkDevices();

            if (isWidget === true) this.widget = true;

            if (isAdmin !== undefined && isAdmin === true) {
                this.userStatus = 'admin';
                this.adminKey = this.randomString(16, '#a');
            }

            if (isSid === null) {
                isSid = false;
            }
            this.domainName = domain;
            this.serverName = domain;
            this.userName = userName;

            this.conflict = false;
            this.closeTimeout = null;
            this.urlID = null;
            this.hubTaskReferer = null;
            this.currentCalls = null;
            this.currentCalls = [];

            this.isSdpText = false;

            if (this.isSdpText === true) {
                this.xmlSdp = "sdpText";
            } else {
                this.xmlSdp = "sdp";
            }

            if(domain==='sipnet.ru'){
                domain='ipv4.sipnet.ru';
            }

            var params = {
                secureMode: "YES",
                serverName: domain,
                binding: "HTTP",
                userName: userName,
                version: "6.2",
                loginMethod: isSid ? "sessionid" : "auto",
                password: passWord,
                sessionid: passWord,
                asyncInput: true,
                asyncOutput: true,
                asyncMode: "asyncPOST",
                pollPeriod: 15,
                killOldSession: true
            };

            this.theSession = new XIMSSSession(params, this, this.ximssLoginCompleted);
        },

        showLocalVideo: function () {
            var self = this;
            navigator.getUserMedia({audio: {optional: [{sourceId: this.audioIn}]}, video: true},
                function (stream) {
                    self.localVideoStream = stream;
                    var localVideo = document.getElementById('localVideo');

                    localVideo.srcObject = stream;
                    if (DEBUG_SIPNET === true) console.log('Show local video');
                },
                function (errObj) {
                    if (DEBUG_SIPNET === true) console.log('Cant init local video:' + JSON.stringify(errObj, null, ' '));
                }
            );
        },

        hideLocalVideo: function () {
            if (this.localVideoStream !== null) {
                if (this.localVideoStream.getAudioTracks()[0] !== undefined) this.localVideoStream.getAudioTracks()[0].stop();
                if (this.localVideoStream.getVideoTracks()[0] !== undefined) this.localVideoStream.getVideoTracks()[0].stop();
                this.localVideoStream = null;
            }
        },


        doLogout: function (agent) {

            if ((agent !== undefined && agent === true) || (this.userStatus === 'admin' && this.adminKey !== '')) {

                if (this.hubTaskReferer !== null) {
                    this.doXimssSendEvent(this.userStatus + '-bye', null, this.hubTaskReferer);
                } else {
                    if (this.conflict === false) {
                        this.userStatus === 'admin' ? this.doXimssTaskDeactivateMeeting('pbx', this.adminKey) : this.doXimssTaskDeactivateMeeting('pbx', this.userStatus);
                    } else {
                        if (DEBUG_SIPNET === true) console.log('doLogout if conflict==true');
                        this.doCloseXimssSession();
                    }
                }
            } else {
                if (DEBUG_SIPNET === true) console.log('doLogout if agent==false');
                this.doCloseXimssSession();
            }

            var self = this;
            this.closeTimeout = setTimeout(function () {
                if (self.theSession !== null) {
                    if (DEBUG_SIPNET === true) console.log('doLogout if setTimeout 2000');
                    self.doForceCloseXimssSession();
                }
            }, 2000);
        },

        doXimssSendMsg: function (peer, type, msgText) {
            var sendIMRequest = this.theSession.createXMLNode("sendIM");
            sendIMRequest.setAttribute("peer", peer);
            sendIMRequest.setAttribute("type", type);

            this.userStatus === 'admin' ?
                sendIMRequest.setAttribute("clientID", this.adminKey) :
                sendIMRequest.setAttribute("clientID", this.userStatus);


            if (msgText === "<composing/>") {
                sendIMRequest.appendChild(this.theSession.createXMLNode('composing'));
            } else if (msgText === "<gone/>") {
                sendIMRequest.appendChild(this.theSession.createXMLNode('gone'));
            } else if (msgText) {
                sendIMRequest.appendChild(this.theSession.createTextNode(msgText));
            }
            this.theSession.sendRequest(sendIMRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
        },


        doXimssSendIM: function (peer, type, msgText) {
            var sendIMRequest = this.theSession.createXMLNode("sendIM");
            sendIMRequest.setAttribute("peer", peer);
            sendIMRequest.setAttribute("type", type);

            if (msgText === "<composing/>") {
                sendIMRequest.appendChild(this.theSession.createXMLNode('composing'));
                this.doXimssFileWriteLastChat(peer);
            } else if (msgText === "<gone/>") {
                sendIMRequest.appendChild(this.theSession.createXMLNode('gone'));
                this.doXimssFileWriteLastChat(peer);
            } else if (msgText) {
                sendIMRequest.appendChild(this.theSession.createTextNode(msgText));
            }


            this.theSession.sendRequest(sendIMRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
        },

        doXimssSendCgCardId: function (peer, cardid) {
            var sendIMRequest = this.theSession.createXMLNode("sendIM");
            sendIMRequest.setAttribute("peer", peer);
            sendIMRequest.setAttribute("type", "chat");
            this.userStatus === 'admin' ?
                sendIMRequest.setAttribute("clientID", this.adminKey) :
                sendIMRequest.setAttribute("clientID", this.userStatus);

            sendIMRequest.appendChild(this.theSession.createTextNode('Вам отправлена карточка клиента с номером ' + cardid + '. Используйте рабочее место оператора ВАТС для работы с карточками клиентов.'));

            this.theSession.sendRequest(sendIMRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
        },

        doXimssSendCRMlink: function (peer, link) {
            var sendIMRequest = this.theSession.createXMLNode("sendIM");
            sendIMRequest.setAttribute("peer", peer);
            sendIMRequest.setAttribute("type", "chat");
            this.userStatus === 'admin' ?
                sendIMRequest.setAttribute("clientID", this.adminKey) :
                sendIMRequest.setAttribute("clientID", this.userStatus);
            sendIMRequest.appendChild(this.theSession.createTextNode('Вам отправлена CRM-ссылка ' + link + '. Используйте рабочее место оператора ВАТС для работы CRM-ссылками.'));

            this.theSession.sendRequest(sendIMRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
        },


        doStartCall: function (peer, callid, audioIn, ifVideo) {

            earlyMedia = false;
            if (!this.logined) {
                if (DEBUG_SIPNET === true) console.log("User not logined to server");
                return;
            }

            this.remotePeer = peer;

            if (this.currentCalls === undefined) this.currentCalls = new Array();
            if (this.currentCalls[callid] === undefined) this.currentCalls[callid] = new Array();
            this.currentCalls[callid]['peer'] = peer;
            if (DEBUG_SIPNET === true) console.log("Session started: " + callid);

            this.isVideo = ifVideo === true;


            this.initRTC(callid, audioIn);
        },


        doHold: function (callid) {
            if (!this.currentCalls || !this.currentCalls[callid]) return;

            var offerOptions = this.ifFirefox === true ? {'offerToReceiveAudio': false} : {'mandatory': {'OfferToReceiveAudio': false}};

            this.currentCalls[callid]['isHold'] = true;

            if (this.currentCalls[callid]['pc'] !== null) {
                this.unsubscribePC(this.currentCalls[callid]['pc']);
                this.currentCalls[callid]['pc'].close();
                this.currentCalls[callid]['pc'] = null;
            }


            this.currentCalls[callid]['pc'] = new RTCPeerConnection(configuration, {'mandatory': {'DtlsSrtpKeyAgreement': 'true'}});

            var self = this;

            this.currentCalls[callid]['pc'].onicegatheringstatechange = function () {

                if (self.currentCalls[callid] === undefined || self.currentCalls === undefined) return;

                if (self.currentCalls[callid]['pc'] !== null)
                    if (DEBUG_SIPNET === true)
                        console.log('onicegatheringstatechange: ' + self.currentCalls[callid]['pc'].iceGatheringState);


                //после сбора ICE запускаем и обнуляем таймер если он не отработал раньше
                if (self.currentCalls[callid]['pc'].iceGatheringState === "complete") {
                    if (self.holdTimer!==null) {
                        if (DEBUG_SIPNET === true) console.log("ICE complete, try to update accept...");
                        clearTimeout(self.holdTimer);
                        self.holdTimer = null;
                        if (DEBUG_SIPNET === true) console.log("clear holdTimer on complete");
                        self.Hold();
                    }else{
                        if (DEBUG_SIPNET === true) console.log("May be first timer is work, not calling...");
                    }
                }

            };


            this.currentCalls[callid]['pc'].onicecandidate = function (event) {
                if (!event.candidate) {

                }
            };

            this.currentCalls[callid]['pc'].addStream(this.currentCalls[callid]['localStream']);

            this.currentCalls[callid]['pc'].createOffer(
                function (desc) {
                    self.currentCalls[callid]['pc'].setLocalDescription(desc,
                        function () {
                            if (DEBUG_SIPNET === true) console.log("Success setLocalDescription33333");

                            self.holdTimer=setTimeout(function(){
                                if (self.holdTimer!==null) {
                                    if (DEBUG_SIPNET === true) console.log("ICE timeout, try to hold...");
                                    self.holdTimer = null;
                                    self.Hold();
                                }
                            }, 1000);


                        },
                        function (errObj) {
                            if (DEBUG_SIPNET === true) console.log("UnSuccess setLocalDescription");
                            self.ximssErr('Error create local SDP:' + JSON.stringify(errObj, null, ' '));
                        }
                    );
                },

                function (err) {
                    if (DEBUG_SIPNET === true) console.log("createOffer_error():", err);
                },
                offerOptions
            );

            this.Hold=()=> {
                if (self.theSession !== null) {
                    if (DEBUG_SIPNET === true) console.log('Local SDP complete:' + self.currentCalls[callid]['pc'].localDescription.sdp);
                    var startCallRequest = self.theSession.createXMLNode("callUpdate");
                    startCallRequest.setAttribute("callLeg", self.currentCalls[callid]['callLeg']);
                    startCallRequest.setAttribute("media", "WebRTC");
                    var sdpXml = self.theSession.createXMLNode(self.xmlSdp);


                    if (self.isSdpText === false) {
                        var docXML = (new DOMParser()).parseFromString("<root/>", "text/xml");
                        sdpXml = SDPXML.parseText(self.currentCalls[callid]['pc'].localDescription.sdp, docXML);
                        SDPXML.adjustWebRTCXML(sdpXml, null);
                    } else {
                        sdpXml.appendChild(self.theSession.createTextNode(self.currentCalls[callid]['pc'].localDescription.sdp));
                    }

                    startCallRequest.appendChild(sdpXml);
                    self.theSession.sendRequest(startCallRequest, ximssSession, self.ximssDataCallback, self.ximssOpCompleted, true);

                    if (self.currentCalls[callid]['localStream'].getVideoTracks()[0] !== undefined)
                        self.currentCalls[callid]['localStream'].getVideoTracks()[0].enabled = false;
                    self.currentCalls[callid]['localStream'].getAudioTracks()[0].enabled = false;

                }
            }

        },


        doUnhold: function (callid) {
            if (!this.currentCalls || !this.currentCalls[callid]) return;

            this.currentCalls[callid]['isHold'] = false;

            if (this.currentCalls[callid]['pc'] !== null) {
                this.unsubscribePC(this.currentCalls[callid]['pc']);
                this.currentCalls[callid]['pc'].close();
                this.currentCalls[callid]['pc'] = null;
            }

            this.currentCalls[callid]['pc'] = new RTCPeerConnection(configuration, {'mandatory': {'DtlsSrtpKeyAgreement': 'true'}});

            var self = this;

            this.currentCalls[callid]['pc'].onicegatheringstatechange = function () {

                if (self.currentCalls[callid] === undefined || self.currentCalls === undefined) return;

                if (self.currentCalls[callid]['pc'] !== null)
                    if (DEBUG_SIPNET === true)
                        console.log('onicegatheringstatechange: ' + self.currentCalls[callid]['pc'].iceGatheringState);

                //после сбора ICE запускаем и обнуляем таймер если он не отработал раньше
                if (self.currentCalls[callid]['pc'].iceGatheringState === "complete") {
                    if (self.unholdTimer!==null) {
                        if (DEBUG_SIPNET === true) console.log("ICE complete, try to update accept...");
                        clearTimeout(self.unholdTimer);
                        self.unholdTimer = null;
                        if (DEBUG_SIPNET === true) console.log("clear unholdTimer on complete");
                        self.Unhold();
                    }else{
                        if (DEBUG_SIPNET === true) console.log("May be first timer is work, not calling...");
                    }
                }

            };

            this.currentCalls[callid]['pc'].onicecandidate = function (event) {
                if (!event.candidate) {

                }
            };

            this.currentCalls[callid]['pc'].addStream(this.currentCalls[callid]['localStream']);


            this.currentCalls[callid]['pc'].createOffer(
                function (desc) {
                    self.currentCalls[callid]['pc'].setLocalDescription(desc,
                        function () {
                            self.unholdTimer=setTimeout(function(){
                                if (self.unholdTimer!==null) {
                                    if (DEBUG_SIPNET === true) console.log("ICE timeout, try to unhold...");
                                    self.unholdTimer = null;
                                    self.Unhold();
                                }
                            }, 1000);
                        },
                        function (errObj) {
                            if (DEBUG_SIPNET === true) console.log("UnSuccess setLocalDescription");
                            self.ximssErr('Error create local SDP:' + JSON.stringify(errObj, null, ' '));
                        }
                    );
                },
                function (err) {
                    if (DEBUG_SIPNET === true) console.log("createOffer_error():", err);
                },
                {}
            );

            this.Unhold=()=> {
                if (self.theSession !== null) {
                    var startCallRequest = self.theSession.createXMLNode("callUpdate");
                    startCallRequest.setAttribute("callLeg", self.currentCalls[callid]['callLeg']);
                    startCallRequest.setAttribute("media", "WebRTC");


                    var sdpXml = self.theSession.createXMLNode(self.xmlSdp);


                    if (self.isSdpText === false) {
                        var docXML = (new DOMParser()).parseFromString("<root/>", "text/xml");
                        sdpXml = SDPXML.parseText(self.currentCalls[callid]['pc'].localDescription.sdp, docXML);
                        SDPXML.adjustWebRTCXML(sdpXml, null);
                    } else {
                        sdpXml.appendChild(self.theSession.createTextNode(self.fixOutSDPhold(self.currentCalls[callid]['pc'].localDescription.sdp, false)));

                    }


                    startCallRequest.appendChild(sdpXml);
                    self.theSession.sendRequest(startCallRequest, ximssSession, self.ximssDataCallback, self.ximssOpCompleted, true);
                    if (self.currentCalls[callid]['isMute'] === undefined || self.currentCalls[callid]['isMute'] === false) {
                        self.currentCalls[callid]['localStream'].getAudioTracks()[0].enabled = true;
                        if (self.currentCalls[callid]['localStream'].getVideoTracks()[0] !== undefined)
                            self.currentCalls[callid]['localStream'].getVideoTracks()[0].enabled = true;
                    }
                }
            }
        },


        doUpdate: function (callid, audioIn, ifVideo) {

            if (DEBUG_SIPNET === true) console.log("Update with device: " + audioIn);

            var self = this;

            if (this.currentCalls[callid] === undefined) {
                return;
            } else if (this.currentCalls[callid]['pc'] === undefined) {
                return;
            } else if (this.currentCalls[callid]['pc'].signalingState !== 'stable') {
                return;
            }

            if (ifVideo !== undefined && ifVideo === true) {
                this.isVideo = true;
            }


            if (this.ifFirefox === true) {


                if (this.currentCalls[callid]['pc'].signalingState === 'stable') {


                    this.currentCalls[callid]['pc'].getSenders().forEach(function (sender) {
                        self.currentCalls[callid]['localStream'].getTracks().forEach(function (track) {
                            if (sender.track === track) {
                                self.currentCalls[callid]['pc'].removeTrack(sender);
                                if (DEBUG_SIPNET === true) console.log('removeTrack');
                            }
                        });
                    });

                }
            } else {
                this.currentCalls[callid]['pc'].removeStream(this.currentCalls[callid]['localStream']);
            }


            this.currentCalls[callid]['localStream'] = null;

            if (this.currentCalls[callid]['pc'] !== null) {
                this.unsubscribePC(this.currentCalls[callid]['pc']);
                this.currentCalls[callid]['pc'].close();
                this.currentCalls[callid]['pc'] = null;
            }

            this.audioIn = audioIn;
            if (DEBUG_SIPNET === true) console.log("change device to: ", this.audioIn);

            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;


            if (!this.videoDevices || !this.videoDevices.length || this.userStatus === 'admin') {
                this.isVideo = false;
            }

            navigator.getUserMedia({audio: {optional: [{sourceId: this.audioIn}]}, video: this.isVideo},
                function (stream) {
                    if (self.currentCalls[callid] === undefined || self.currentCalls === undefined) return;
                    self.onUserMediaSuccess();
                    var e = document.getElementById('audioElem_' + callid);
                    e.srcObject = stream;

                    self.currentCalls[callid]['localStream'] = stream;
                    self.doUnhold(callid);
                },
                function (errObj) {
                    var message = '';
                    switch (errObj.name) {
                        case 'NotFoundError':
                        case 'DevicesNotFoundError':
                            message = 'Please setup your microphone.';
                            break;
                        case 'SourceUnavailableError':
                            message = 'Your microphone is busy.';
                            break;
                        case 'PermissionDeniedError':
                        case 'SecurityError':
                            message = 'Microphone access permission denied.';
                            break;
                        default:
                            message = 'Something wrong with media devices.';
                    }

                    this.ximssCallReject(1);
                    this.onUserMediaError(message);

                }
            );
        },


        doMute: function (callid) {
            if (DEBUG_SIPNET === true) console.log("Mute line: " + callid);
            if (this.currentCalls === undefined) return;
            if (this.currentCalls[callid] === undefined) return;
            if (this.currentCalls[callid]['localStream'] === undefined) return;

            this.currentCalls[callid]['localStream'].getAudioTracks()[0].enabled = false;
            if (this.currentCalls[callid]['localStream'].getVideoTracks()[0] !== undefined)
                this.currentCalls[callid]['localStream'].getVideoTracks()[0].enabled = false;
            this.currentCalls[callid]['isMute'] = true;
        },

        doUnmute: function (callid) {
            if (DEBUG_SIPNET === true) console.log("Unmute line: " + callid);
            if (this.currentCalls === undefined) return;
            if (this.currentCalls[callid] === undefined) return;
            if (this.currentCalls[callid]['localStream'] === undefined) return;
            this.currentCalls[callid]['localStream'].getAudioTracks()[0].enabled = true;
            if (this.currentCalls[callid]['localStream'].getVideoTracks()[0] !== undefined)
                this.currentCalls[callid]['localStream'].getVideoTracks()[0].enabled = true;
            this.currentCalls[callid]['isMute'] = false;
        },

        doDTMFCreate: function (callid) {

            if (this.currentCalls === undefined) return;
            if (this.currentCalls[callid] === undefined) return;
            if (this.currentCalls[callid]['pc'] !== null) {

                var senders = this.currentCalls[callid]['pc'].getSenders();
                var audioSender = senders.find(function (sender) {
                    return sender.track && sender.track.kind === 'audio';
                });
                if (!audioSender) {
                    if (DEBUG_SIPNET === true) console.log('No local audio track to send DTMF with');
                    return;
                }
                if (!audioSender.dtmf) {
                    if (DEBUG_SIPNET === true) console.log('DTMF is not support by this browser.');
                    return;
                }
                this.currentCalls[callid]['dtmfSender'] = audioSender.dtmf;


            }
        },

        doDTMFSend: function (tone, callid) {
            var self = this;
            this.doDTMFCreate(callid);
            if (this.currentCalls[callid]['dtmfSender']) {
                this.currentCalls[callid]['dtmfSender'].insertDTMF(tone, 500, 50);
                setTimeout(function n() {
                    self.currentCalls[callid]['dtmfSender'] = null;
                }, 610);
            } else {
                this.ximssCallSendDTMF(tone, callid);
            }
        },

        doCallUpdateAccept: function (callid) {
            if (this.theSession !== null) {
                if (this.currentCalls[callid] === null) return;
                if (this.currentCalls[callid]['callLeg'] === null) return;
                var startUpdAccRequest = this.theSession.createXMLNode("callUpdateAccept");
                startUpdAccRequest.setAttribute("callLeg", this.currentCalls[callid]['callLeg']);
                this.theSession.sendRequest(startUpdAccRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        ximssCallSendDTMF: function (tone, callid) {
            if (this.theSession !== null) {
                var callSendDTMF = this.theSession.createXMLNode("callSendDTMF");
                callSendDTMF.setAttribute("callLeg", this.currentCalls[callid]['callLeg']);
                callSendDTMF.appendChild(this.theSession.createTextNode(tone));
                this.theSession.sendRequest(callSendDTMF, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        ximssMakeCall: function (peer) {
            if (this.theSession !== null) {
                var makeCall = this.theSession.createXMLNode("makeCall");
                makeCall.setAttribute("peer", peer);
                this.theSession.sendRequest(makeCall, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        ximssTransferCall: function (peer, from, to) {
            if (this.theSession !== null && from !== '') {
                var transferCall = this.theSession.createXMLNode("callTransfer");

                if (this.currentCalls[from] === undefined) return;

                if (to !== '') {
                    if (this.currentCalls[to] === undefined) return;
                }
                transferCall.setAttribute("callLeg", this.currentCalls[from]['callLeg']);
                if (to !== '') {
                    transferCall.setAttribute("otherLeg", this.currentCalls[to]['callLeg']);
                } else
                    transferCall.setAttribute("peer", peer);
                this.theSession.sendRequest(transferCall, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        ximssRedirectCall: function (peer, callid) {
            if (this.theSession !== null) {
                var redirectCall = this.theSession.createXMLNode("callRedirect");
                redirectCall.setAttribute("callLeg", this.currentCalls[callid]['callLeg']);

                var to = this.theSession.createXMLNode("To");
                to.appendChild(this.theSession.createTextNode(peer));
                redirectCall.appendChild(to);

                this.theSession.sendRequest(redirectCall, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doCallUpdateReject: function (callid, code) {
            if (this.theSession !== null) {
                var callUpdateReject = this.theSession.createXMLNode("callUpdateReject");
                callUpdateReject.setAttribute("callLeg", this.currentCalls[callid]['callLeg']);
                callUpdateReject.setAttribute("signalCode", code);
                this.theSession.sendRequest(callUpdateReject, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);

            }
        },

        doCallKill: function (callid) {
            deleteLocalKPV();

            if (this.currentCalls[callid] === undefined) return;
            if (this.currentCalls[callid]['callLeg'] === "" || this.currentCalls[callid]['callLeg'] === undefined) return;
            if (this.currentCalls[callid]['pc'] !== null) {

                var self = this;

                if (this.ifFirefox === true) {

                    if (this.currentCalls[callid]['pc'].signalingState === 'stable') {

                        this.currentCalls[callid]['pc'].getSenders().forEach(function (sender) {
                            self.currentCalls[callid]['localStream'].getTracks().forEach(function (track) {
                                if (sender.track === track) {
                                    self.currentCalls[callid]['pc'].removeTrack(sender);
                                    if (DEBUG_SIPNET === true) console.log('removeTrack');
                                }
                            });
                        });

                    }
                } else {
                    this.currentCalls[callid]['pc'].removeStream(this.currentCalls[callid]['localStream']);
                }


                if (this.currentCalls[callid]['pc'] !== null) {
                    this.unsubscribePC(this.currentCalls[callid]['pc']);
                    this.currentCalls[callid]['pc'].close();
                    this.currentCalls[callid]['pc'] = null;
                }
            }

            var e = document.getElementById('audioElem_' + callid);
            try {
                e.pause();
            } catch (e) {
                if (DEBUG_SIPNET === true) console.log("No found audioElem!");
            }

            if (this.currentCalls[callid]['localStream'] !== null) {
                this.currentCalls[callid]['localStream'].getAudioTracks()[0].stop();
                if (this.currentCalls[callid]['localStream'].getVideoTracks()[0] !== undefined) this.currentCalls[callid]['localStream'].getVideoTracks()[0].stop();
            }

            this.currentCalls[callid]['dtmfSender'] = null;

            if (this.theSession !== null) {
                var startCallKillRequest = this.theSession.createXMLNode("callKill");
                startCallKillRequest.setAttribute("callLeg", this.currentCalls[callid]['callLeg']);
                this.theSession.sendRequest(startCallKillRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }

            delete this.currentCalls[callid];
            if (DEBUG_SIPNET === true) console.log("Session deleted: " + callid);
        },

        doRosterList: function () {
            if (this.theSession !== null) {
                var rosterSetRequest = this.theSession.createXMLNode("rosterList");
                this.theSession.sendRequest(rosterSetRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doPresenceSet: function (status) {
            if (this.theSession !== null) {
                var presenceSetRequest = this.theSession.createXMLNode("presenceSet");

                var statusNode = this.theSession.createXMLNode('presence');
                statusNode.appendChild(this.theSession.createTextNode(status));
                var statusNode2 = this.theSession.createXMLNode('status');
                presenceSetRequest.appendChild(statusNode);
                presenceSetRequest.appendChild(statusNode2);
                this.theSession.sendRequest(presenceSetRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        ximssLoginCompleted: function (session, errorCode) {
            if (errorCode !== null) {
                if (this.onXimssErrorLogin) this.onXimssErrorLogin(errorCode);
                return;
            }

            this.logined = true;
            this.theSession = session;

            this.theSession.setAsyncProcessor(this, this.ximssAsyncAll, null, null, null);
            this.theSession.setAsyncProcessor(this, this.ximssAsyncSession, "session", null, null);
            this.theSession.setNetworkErrorProcessor(this, this.ximssNetworkErrorProcessor, 10);
            this.theSession.setNetworkOKProcessor(this, this.ximssNetworkOKProcessor);

            this.theSession.start();

            if (this.onXimssSuccessLogin) this.onXimssSuccessLogin();
            this.doXimssSetOption('idleTimeout', '60');
            this.widget === true ? this.doSetClientName("amocrm"): this.userStatus === 'admin' ? this.doSetClientName("adminworkplace"):this.doSetClientName("workplace");
        },

        ximssSignalBind: function (isPresence, isVideo) {
            if (DEBUG_SIPNET === true) console.log("start SignalBind");
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            if (DEBUG_SIPNET === true) console.log(this.audioDevices);
            if (DEBUG_SIPNET === true) console.log(this.videoDevices);


            var isVideo = true;

            if (this.videoDevices && this.videoDevices.length) {
                this.userStatus === 'admin' ? isVideo = false : isVideo = true;
            } else {
                isVideo = false;
            }
            var self = this;


            navigator.getUserMedia({audio: true, video: isVideo},
                function (stream) {
                    if (self.theSession === null) {
                        stream.getAudioTracks()[0].stop();
                        if (stream.getVideoTracks()[0] !== undefined)
                            stream.getVideoTracks()[0].stop();
                        if (DEBUG_SIPNET === true) console.log('ximssSession is null');
                        return;
                    }

                    self.onUserMediaSuccess();
                    self.localStream = stream;

                    if (self.pc !== null) {
                        self.pc.close();
                        self.pc = null;
                    }

                    self.pc = new RTCPeerConnection(configuration, {'mandatory': {'DtlsSrtpKeyAgreement': 'true', 'OfferToReceiveAudio': 'true', 'OfferToReceiveVideo': 'true'}});

                    let confi= self.pc.getConfiguration();

                    if (DEBUG_SIPNET === true) console.log('CONF: ', confi);

                    self.pc.onicecandidate = function (event) {
                        if (!event.candidate) {}
                    };

                    self.pc.addStream(self.localStream);

                    self.pc.createOffer(
                        function (desc) {
                            self.pc.setLocalDescription(desc,
                                function () {
                                    if (DEBUG_SIPNET === true) console.log("setLocalDescription...");
                                    self.bindingCallTimer=setTimeout(function(){
                                        if (self.bindingCallTimer!==null) {
                                            if (DEBUG_SIPNET === true) console.log("ICE timeout, try to binding...");
                                            self.bindingCallTimer = null;
                                            self.callSignalBind();
                                        }
                                    }, 1000);
                                },
                                function (errObj) {
                                    if (DEBUG_SIPNET === true) console.log("UnSuccess setLocalDescription");
                                    self.ximssErr('Error create local SDP:' + JSON.stringify(errObj, null, ' '));

                                    if (self.ifFirefox === true) {

                                        if (self.pc.signalingState === 'stable') {

                                            self.pc.getSenders().forEach(function (sender) {
                                                self.localStream.getTracks().forEach(function (track) {
                                                    if (sender.track === track) {
                                                        self.pc.removeTrack(sender);
                                                        if (DEBUG_SIPNET === true) console.log('removeTrack');
                                                    }
                                                });
                                            });
                                        }
                                    } else {
                                        self.pc.removeStream(self.localStream);
                                    }

                                    if (self.pc !== null) {
                                        self.pc.close();
                                        self.pc = null;
                                        self.localStream.stop();
                                    }

                                }
                            );
                        },
                        function (err) {
                            if (DEBUG_SIPNET === true) console.log("createOffer_error():", err);
                        },
                        {}
                    );

                    self.callSignalBind=()=>{
                        if (self.theSession !== null) {
                            var signalBindRequest = self.theSession.createXMLNode("signalBind");

                            self.userStatus === 'admin' ?
                                signalBindRequest.setAttribute("deviceName", self.adminKey) :
                                signalBindRequest.setAttribute("deviceName", self.userStatus);

                            self.userStatus === 'admin' ?
                                signalBindRequest.setAttribute("clientID", self.adminKey) :
                                signalBindRequest.setAttribute("clientID", self.userStatus);

                            if (isPresence === false) {
                                self.isPresence = false;
                            } else {
                                self.isPresence = true;
                                signalBindRequest.setAttribute("presence", "yes");
                            }

                            signalBindRequest.setAttribute("readIM", "1");


                            var sdpXml2 = self.theSession.createXMLNode(self.xmlSdp);

                            if (self.isSdpText === false) {
                                var docXML = (new DOMParser()).parseFromString("<root/>", "text/xml");
                                sdpXml2 = SDPXML.parseText(self.fixIpV6SDP(self.pc.localDescription.sdp), docXML);
                                SDPXML.adjustWebRTCXML(sdpXml2, null);
                            } else {
                                sdpXml2.appendChild(self.theSession.createTextNode(self.fixOutSDP(self.pc.localDescription.sdp)));
                            }

                            signalBindRequest.appendChild(sdpXml2);
                            self.theSession.sendRequest(signalBindRequest, ximssSession, self.ximssDataCallback, self.ximssOpCompleted, true);
                        }
                    };

                },
                function (errObj) {
                    var message = '';
                    switch (errObj.name) {
                        case 'NotFoundError':
                        case 'DevicesNotFoundError':
                            message = 'Please setup your microphone.';
                            break;
                        case 'SourceUnavailableError':
                            message = 'Your microphone is busy.';
                            break;
                        case 'PermissionDeniedError':
                        case 'SecurityError':
                            message = 'Microphone access permission denied.';
                            break;
                        default:
                            message = 'Something wrong with media devices.';
                    }

                    self.onUserMediaError(message);
                    if (DEBUG_SIPNET === true) console.log('Error in getUserMedia: ' + message);

                }
            );
        },


        ximssSignalBindNoWebRTC: function (isPresence) {
            if (DEBUG_SIPNET === true) console.log("start SignalBind without WebRTC");
            navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

            if (DEBUG_SIPNET === true) console.log(this.audioDevices);


            var isVideo = false;

            var self = this;

            navigator.getUserMedia({audio: true, video: isVideo},
                function (stream) {

                    if (self.theSession === null) {
                        stream.getAudioTracks()[0].stop();
                        if (stream.getVideoTracks()[0] !== undefined)
                            stream.getVideoTracks()[0].stop();
                        if (DEBUG_SIPNET === true) console.log('ximssSession is null');
                        return;
                    }

                    self.onUserMediaSuccess();

                    if (self.theSession !== null) {
                        var signalBindRequest = self.theSession.createXMLNode("signalBind");

                        self.userStatus === 'admin' ?
                            signalBindRequest.setAttribute("deviceName", self.adminKey) :
                            signalBindRequest.setAttribute("deviceName", self.userStatus);

                        self.userStatus === 'admin' ?
                            signalBindRequest.setAttribute("clientID", self.adminKey) :
                            signalBindRequest.setAttribute("clientID", self.userStatus);

                        if (isPresence === false) {
                            self.isPresence = false;
                        } else {
                            self.isPresence = true;
                            signalBindRequest.setAttribute("presence", "yes");
                        }

                        signalBindRequest.setAttribute("readIM", "1");


                        var fakeSDP = '<sdp origUser="-" sessionID="6528207572740520089" sessionVersion="2" origIP="[127.0.0.1]"><attr name="group">BUNDLE audio</attr><attr name="msid-semantic"> WMS cDtIeOo7PWG5mzHLSdaaX5v6OpWFw0xUSIrQ</attr><media media="audio" protocol="RTP/SAVPF" ip="[10.255.255.255]:50739" rtcp="[0.0.0.0]:9" direction="sendrecv"><codec id="0" name="PCMU/8000"/><codec id="8" name="PCMA/8000"/><codec id="126" name="telephone-event/8000"/></media><attr name="webrtc">yes</attr></sdp>';
                        var xmlFakeSDP = self.str2xml(fakeSDP);

                        signalBindRequest.appendChild(xmlFakeSDP);

                        self.theSession.sendRequest(signalBindRequest, ximssSession, self.ximssDataCallback, self.ximssOpCompleted, true);
                    }
                },
                function (errObj) {
                    var message = '';
                    switch (errObj.name) {
                        case 'NotFoundError':
                        case 'DevicesNotFoundError':
                            message = 'Please setup your microphone.';
                            break;
                        case 'SourceUnavailableError':
                            message = 'Your microphone is busy.';
                            break;
                        case 'PermissionDeniedError':
                        case 'SecurityError':
                            message = 'Microphone access permission denied.';
                            break;
                        default:
                            message = 'Something wrong with media devices.';
                    }

                    self.onUserMediaError(message);
                    if (DEBUG_SIPNET === true) console.log('Error in getUserMedia: ' + message);

                }
            );
        },


        doUploadVCard: function (fileData) {
            var uploadId = Math.round(1000000000 * Math.random());

            var fd = new FormData();
            fd.append('fileData', fileData);

            var self = this;

            $.ajax({
                url: '//' + this.serverName + '/Session/' + this.urlID + '/UPLOAD/' + uploadId,
                data: fd,
                processData: false,
                contentType: false,
                type: 'POST',
                success: function (data) {
                    self.onXimssVCardUploaded(uploadId);
                }
            });
        },

        doStat: function () {
            var tp="other";
            this.widget === true ? tp="amocrm": this.userStatus === "admin" ? tp="adminworkplace":this.userStatus === "agent" ? tp="workplace":tp="other";

            var fd = new FormData();
            fd.append('session', this.urlID);
            fd.append('login', this.userName);
            fd.append('domain', this.domainName);
            fd.append('type', tp);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://newapi.sipnet.ru/monsessions.php', true);
            xhr.onload = function () {
            };
            xhr.send(fd);
        },

        doGetSessionId: function (crm_user_id, api_key) {

            var self = this;

            if (DEBUG_SIPNET === true) console.log("Request: " + JSON.stringify(({
                'crm_user_id': crm_user_id, 'api_key': api_key
            })), null, 4);

            $.ajax({
                url: 'https://www.sipnet.ru/Session/null/user/getsession',
                type: 'GET',
                data: ({
                    'crm_user_id': crm_user_id, 'api_key': api_key
                }),
                success: function (data) {
                    if (DEBUG_SIPNET === true) console.log("Response: " + JSON.stringify(data, null, 4));
                    self.onGetSessionId(data);
                }
            });

        },

        ximssSignalBindForDevice: function (isPresence) {

            if (DEBUG_SIPNET === true) console.log("start SignalBindForDevice");

            if (this.theSession !== null) {

                var signalBindRequest = this.theSession.createXMLNode("signalBind");
                var sdpXml2 = this.theSession.createXMLNode(this.xmlSdp);

                if (isPresence !== null && isPresence === false) {
                    this.isPresence = false;
                } else {
                    this.isPresence = true;
                    signalBindRequest.setAttribute("presence", "yes");
                }

                signalBindRequest.setAttribute("readIM", "1");

                sdpXml2.appendChild(this.theSession.createTextNode('v=0\ns=-\nt=0 0\no=- 1 2 IN IP4 127.0.0.1\n'));
                signalBindRequest.appendChild(sdpXml2);
                this.theSession.sendRequest(signalBindRequest, this, null, this.ximssOpCompleted, true);
            }
        },

        ximssSignalUnbind: function () {
            if (DEBUG_SIPNET === true) console.log("start SignalUnbind");
            if (this.theSession !== null) {
                var signalUnbindRequest = this.theSession.createXMLNode("signalUnbind");
                this.theSession.sendRequest(signalUnbindRequest, this, null, this.ximssOpCompleted, true);
            }
        },

        ximssCallReject: function (callid) {
            if (this.currentCalls[callid] === undefined) return;
            if (this.theSession !== null) {
                var callRejectResponse = this.theSession.createXMLNode("callReject");
                callRejectResponse.setAttribute("callLeg", this.currentCalls[callid]['callLeg']);
                callRejectResponse.setAttribute("signalCode", '486');
                this.rejectId = callid;
                this.theSession.sendRequest(callRejectResponse, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssFindTaskMeeting: function (meetingSet, meetingName) {
            if (this.theSession !== null) {
                var sendFindTaskMeetingRequest = this.theSession.createXMLNode("taskFindMeeting");
                sendFindTaskMeetingRequest.setAttribute("meetingSet", meetingSet);
                sendFindTaskMeetingRequest.setAttribute("meetingName", meetingName);
                this.theSession.sendRequest(sendFindTaskMeetingRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssTaskCreateMeeting: function (meetingSet, meetingName) {
            if (this.theSession !== null) {
                var sendTaskCreateMeetingRequest = this.theSession.createXMLNode("taskCreateMeeting");
                sendTaskCreateMeetingRequest.setAttribute("meetingSet", meetingSet);
                sendTaskCreateMeetingRequest.setAttribute("meetingName", meetingName);
                this.theSession.sendRequest(sendTaskCreateMeetingRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssTaskActivateMeeting: function (meetingSet, meetingName) {
            if (this.theSession !== null) {
                var sendTaskActivateMeetingRequest = this.theSession.createXMLNode("taskActivateMeeting");
                sendTaskActivateMeetingRequest.setAttribute("meetingSet", meetingSet);
                sendTaskActivateMeetingRequest.setAttribute("meetingName", meetingName);
                this.theSession.sendRequest(sendTaskActivateMeetingRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssTaskDeactivateMeeting: function (meetingSet, meetingName) {
            if (this.theSession !== null) {
                var sendTaskDeactivateMeetingRequest = this.theSession.createXMLNode("taskDeactivateMeeting");
                sendTaskDeactivateMeetingRequest.setAttribute("meetingSet", meetingSet);
                sendTaskDeactivateMeetingRequest.setAttribute("meetingName", meetingName);
                this.theSession.sendRequest(sendTaskDeactivateMeetingRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssTaskClearMeeting: function (meetingSet, meetingName) {
            if (this.theSession !== null) {
                var sendTaskClearMeetingRequest = this.theSession.createXMLNode("taskClearMeeting");
                sendTaskClearMeetingRequest.setAttribute("meetingSet", meetingSet);
                sendTaskClearMeetingRequest.setAttribute("meetingName", meetingName);
                this.theSession.sendRequest(sendTaskClearMeetingRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssTaskRemoveMeeting: function (meetingSet, meetingName) {
            if (this.theSession !== null) {
                var sendTaskRemoveMeetingRequest = this.theSession.createXMLNode("taskRemoveMeeting");
                sendTaskRemoveMeetingRequest.setAttribute("meetingSet", meetingSet);
                sendTaskRemoveMeetingRequest.setAttribute("meetingName", meetingName);
                this.theSession.sendRequest(sendTaskRemoveMeetingRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssStartTask: function (programName, param) {
            var sendTaskStartRequest = this.theSession.createXMLNode("taskStart");
            sendTaskStartRequest.setAttribute("programName", programName);

            if (param !== '') {
                var paramNode = this.theSession.createXMLNode("param");
                paramNode.appendChild(this.theSession.createTextNode(param));
                sendTaskStartRequest.appendChild(paramNode);
            }

            this.theSession.sendRequest(sendTaskStartRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
        },


        doXimssPasswordModify: function (password, email) {
            if (this.theSession !== null) {
                var sendPasswordModifyRequest = this.theSession.createXMLNode("passwordModify");
                sendPasswordModifyRequest.setAttribute("oldPassword", password);
                sendPasswordModifyRequest.setAttribute("recoveryEmail", email);
                this.theSession.sendRequest(sendPasswordModifyRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssRecoverPassword: function (domain, userName) {
            this.recoverPassword(this.ximssRecoverCallback, domain, userName);
        },

        recoverPassword: function (callback, domain, login) {
            var xmlhttp = new XMLHttpRequest(),
                url = "//" + domain + "/ximssLogin/",
                request = "<XIMSS><recoverPassword id='0' domain='",
                userName = "";

            xmlhttp.open("POST", url, true);
            xmlhttp.setRequestHeader('Content-Type', 'text/xml');
            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState === 4) {
                    callback(xmlhttp.responseText);
                }
            };

            userName = login;

            request += domain + "' userName='";
            request += userName + "' /></XIMSS>";
            xmlhttp.send(request);
        },

        doXimssSendEvent: function (eventName, body, taskRef) {
            if (this.theSession !== null) {
                var sendTaskSendEventRequest = this.theSession.createXMLNode("taskSendEvent");
                sendTaskSendEventRequest.setAttribute("eventName", eventName);
                if (taskRef !== null)
                    sendTaskSendEventRequest.setAttribute("taskRef", taskRef);
                if (body !== null)
                    sendTaskSendEventRequest.appendChild(this.theSession.createTextNode(body));
                this.theSession.sendRequest(sendTaskSendEventRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssSendEventXml: function (eventName, xmlBody, taskRef) {
            if (this.theSession !== null) {
                var sendTaskSendEventRequest = this.theSession.createXMLNode("taskSendEvent");
                sendTaskSendEventRequest.setAttribute("eventName", eventName);
                if (taskRef !== null)
                    sendTaskSendEventRequest.setAttribute("taskRef", taskRef);
                if (xmlBody !== null) {
                    var xmlNodeBody = this.str2xml(xmlBody);
                    sendTaskSendEventRequest.appendChild(xmlNodeBody);
                }

                this.theSession.sendRequest(sendTaskSendEventRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssContactFind: function (peer) {
            if (this.theSession !== null) {
                var sendContactFind = this.theSession.createXMLNode("contactFind");
                sendContactFind.setAttribute("folder", "imVCardQueueFolder");
                sendContactFind.setAttribute("peer", peer);
                sendContactFind.setAttribute("totalSizeLimit", "3145728");
                this.theSession.sendRequest(sendContactFind, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssIqSend: function (peer) {
            if (this.theSession !== null) {
                var iqSend = this.theSession.createXMLNode("iqSend");
                iqSend.setAttribute("type", "get");
                iqSend.setAttribute("peer", peer);
                iqSend.setAttribute("iqid", "iqid" + getRandomInt(10, 1000));


                var vCard = "<vCard xmlns='vcard-temp'/>";
                var parser = new DOMParser();
                var vCardXML = parser.parseFromString(vCard, "text/xml");

                iqSend.appendChild(vCardXML.documentElement);

                this.theSession.sendRequest(iqSend, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFolderOpen: function (mailbox, mailboxClass, folder, filter) {
            if (this.theSession !== null) {
                var sendFolderOpen = this.theSession.createXMLNode("folderOpen");
                sendFolderOpen.setAttribute("folder", folder);
                sendFolderOpen.setAttribute("mailbox", mailbox);
                if (mailboxClass !== null) {
                    sendFolderOpen.setAttribute("mailboxClass", mailboxClass);
                }
                if (filter !== null) {
                    sendFolderOpen.setAttribute("filter", filter);
                    sendFolderOpen.setAttribute("filterField", "FLAGS");
                }
                sendFolderOpen.setAttribute("sortField", "Subject");
                sendFolderOpen.setAttribute("sortOrder", "asc");

                if (folder === "INBOX") {
                    var field = this.theSession.createXMLNode('field');
                    field.appendChild(this.theSession.createTextNode("FLAGS"));
                    sendFolderOpen.appendChild(field);
                }
                if (DEBUG_SIPNET === true) console.log("doXimssFolderOpen: "+folder);
                this.theSession.sendRequest(sendFolderOpen, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFolderClose: function (folder) {
            if (this.theSession !== null) {
                var sendFolderClose = this.theSession.createXMLNode("folderClose");
                sendFolderClose.setAttribute("folder", folder);
                this.theSession.sendRequest(sendFolderClose, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFolderBrowse: function (folder, from, till) {
            if (this.theSession !== null) {
                var sendFolderBrowse = this.theSession.createXMLNode("folderBrowse");
                sendFolderBrowse.setAttribute("folder", folder);
                var index = this.theSession.createXMLNode("index");
                index.setAttribute("from", from);
                index.setAttribute("till", till);
                sendFolderBrowse.appendChild(index);
                this.theSession.sendRequest(sendFolderBrowse, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFolderBrowseByUID: function (folder, uid) {
            if (this.theSession !== null) {
                var sendFolderBrowse = this.theSession.createXMLNode("folderBrowse");
                sendFolderBrowse.setAttribute("folder", folder);
                var uidNode = this.theSession.createXMLNode("uid");
                uidNode.appendChild(this.theSession.createTextNode(uid));
                sendFolderBrowse.appendChild(uidNode);
                this.theSession.sendRequest(sendFolderBrowse, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFolderRead: function (folder, uid) {
            if (this.theSession !== null) {
                var sendFolderRead = this.theSession.createXMLNode("folderRead");
                sendFolderRead.setAttribute("folder", folder);
                sendFolderRead.setAttribute("UID", uid);
                sendFolderRead.setAttribute("totalSizeLimit", "10240000");
                this.theSession.sendRequest(sendFolderRead, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssFolderSync: function (folder) {
            if (this.theSession !== null) {
                var sendFolderSync = this.theSession.createXMLNode("folderSync");
                sendFolderSync.setAttribute("folder", folder);
                this.theSession.sendRequest(sendFolderSync, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssMailboxSubList: function (filter) {
            if (this.theSession !== null) {
                var sendMailboxSubList = this.theSession.createXMLNode("mailboxSubList");
                sendMailboxSubList.setAttribute("filter", filter);
                this.theSession.sendRequest(sendMailboxSubList, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssMailboxRightsGet: function (mailbox) {
            if (this.theSession !== null) {
                var sendMailboxRightsGet = this.theSession.createXMLNode("mailboxRightsGet");
                sendMailboxRightsGet.setAttribute("mailbox", mailbox);
                this.theSession.sendRequest(sendMailboxRightsGet, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssContactAppend: function (targetMailbox, folder, xmlVCard, UID) {
            if (this.theSession !== null) {
                var sendContactAppend = this.theSession.createXMLNode("contactAppend");

                sendContactAppend.setAttribute("folder", folder);
                sendContactAppend.setAttribute("targetMailbox", targetMailbox);

                if (UID !== null) {
                    sendContactAppend.setAttribute("report", "uid");
                    sendContactAppend.setAttribute("replacesUID", UID);
                    sendContactAppend.setAttribute("checkOld", "yes");
                }

                sendContactAppend.appendChild(this.str2xml('<vCard>' + xmlVCard + '</vCard>'));
                this.theSession.sendRequest(sendContactAppend, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssContactRemove: function (folder, UID) {
            if (this.theSession !== null) {
                var sendContactRemove = this.theSession.createXMLNode("messageRemove");
                sendContactRemove.setAttribute("folder", folder);
                var xmlUID = this.theSession.createXMLNode('UID');
                xmlUID.appendChild(this.theSession.createTextNode(UID));
                sendContactRemove.appendChild(xmlUID);
                this.theSession.sendRequest(sendContactRemove, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssContactsImport: function (folder, uploadID) {
            if (this.theSession !== null) {
                var sendContactsImport = this.theSession.createXMLNode("contactsImport");
                sendContactsImport.setAttribute("folder", folder);
                sendContactsImport.setAttribute("uploadID", uploadID);
                this.theSession.sendRequest(sendContactsImport, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssPrefsRead: function () {
            if (this.theSession !== null) {
                var sendPrefsRead = this.theSession.createXMLNode("prefsRead");
                this.theSession.sendRequest(sendPrefsRead, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssPrefsReadCustom: function (pref) {
            if (this.theSession !== null) {
                var sendPrefsReadCustom = this.theSession.createXMLNode("prefsRead");
                sendPrefsReadCustom.setAttribute("type", "custom");
                var name = this.theSession.createXMLNode("name");
                name.appendChild(this.theSession.createTextNode(pref));
                sendPrefsReadCustom.appendChild(name);
                this.theSession.sendRequest(sendPrefsReadCustom, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssPrefsStore: function (propXML) {
            if (this.theSession !== null) {
                var sendPrefsStore = this.theSession.createXMLNode("prefsStore");
                sendPrefsStore.appendChild(this.str2xml(propXML));
                this.theSession.sendRequest(sendPrefsStore, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssSetOption: function (object, value) {
            if (this.theSession !== null) {
                var sendXimssSetOption = this.theSession.createXMLNode("setSessionOption");
                sendXimssSetOption.setAttribute("name", object);
                sendXimssSetOption.setAttribute("value", value);
                this.theSession.sendRequest(sendXimssSetOption, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssBannerRead: function (xmlData, type) {
            if (this.theSession !== null) {
                var sendBannerRead = this.str2xml(xmlData);
                this.theSession.sendRequest(sendBannerRead, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssRaw: function (xmlData) {
            if (this.theSession !== null) {
                var sendRow = this.str2xml(xmlData);
                this.theSession.sendRequest(sendRow, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFileList: function (fileName) {
            if (this.theSession !== null) {
                var sendFileList = this.theSession.createXMLNode("fileList");
                sendFileList.setAttribute("fileName", fileName);
                this.theSession.sendRequest(sendFileList, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFileDirInfo: function (directory) {
            if (this.theSession !== null) {
                var sendFileDirInfo = this.theSession.createXMLNode("fileList");
                sendFileDirInfo.setAttribute("directory", directory);
                this.theSession.sendRequest(sendFileDirInfo, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFileRead: function (type, fileName, position, limit) {
            if (this.theSession !== null) {
                var sendFileRead = this.theSession.createXMLNode("fileRead");

                if (type) sendFileRead.setAttribute("type", type);
                if (position) sendFileRead.setAttribute("position", position);
                if (limit) sendFileRead.setAttribute("limit", limit);
                sendFileRead.setAttribute("fileName", fileName);

                this.theSession.sendRequest(sendFileRead, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFileWrite: function (type, fileName, stringData) {
            if (this.theSession !== null) {
                var sendFileWrite = this.theSession.createXMLNode("fileWrite");
                if (type) sendFileWrite.setAttribute("type", type);
                sendFileWrite.setAttribute("fileName", fileName);
                sendFileWrite.appendChild(this.str2xml(stringData));
                this.theSession.sendRequest(sendFileWrite, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFileWriteDelivery: function (peerId) {
            if (this.theSession !== null) {
                var sendFileWrite = this.theSession.createXMLNode("fileWrite");
                sendFileWrite.setAttribute("fileName", 'private/IM/' + peerId + '.delivery.log');

                var myDate = new Date().toISOString().replace(/-/g, '').replace(/:/g, '').replace(/\..+/, '');


                sendFileWrite.appendChild(this.theSession.createTextNode(myDate));
                this.theSession.sendRequest(sendFileWrite, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFileWriteLastChat: function (peerId) {
            if (this.theSession !== null) {
                var sendFileWrite = this.theSession.createXMLNode("fileWrite");
                sendFileWrite.setAttribute("fileName", 'private/IM/' + peerId + '.lastchat.log');

                var myDate = new Date().toISOString().replace(/-/g, '').replace(/:/g, '').replace(/\..+/, '')

                sendFileWrite.appendChild(this.theSession.createTextNode(myDate));
                this.theSession.sendRequest(sendFileWrite, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssFileRemove: function (fileName) {
            if (this.theSession !== null) {
                var sendFileRemove = this.theSession.createXMLNode("fileRemove");
                sendFileRemove.setAttribute("fileName", fileName);
                this.theSession.sendRequest(sendFileRemove, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },


        doXimssMessageMark: function (flags, folder, UID) {
            if (this.theSession !== null) {
                var sendMessageMark = this.theSession.createXMLNode("messageMark");
                sendMessageMark.setAttribute("folder", folder);
                sendMessageMark.setAttribute("flags", flags);
                var xmlUID = this.theSession.createXMLNode('UID');
                xmlUID.appendChild(this.theSession.createTextNode(UID));
                sendMessageMark.appendChild(xmlUID);
                this.theSession.sendRequest(sendMessageMark, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doXimssCli: function (cli) {
            if (this.theSession !== null) {
                var sendCli = this.theSession.createXMLNode("cliExecute");
                sendCli.appendChild(this.theSession.createTextNode(cli));
                this.theSession.sendRequest(sendCli, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doCloseXimssSession: function () {

            if (DEBUG_SIPNET === true) console.log('closing session...');
            if (this.theSession !== null) {
                this.theSession.close(ximssSession, this.finalCallback);
                this.theSession = null;
                this.logined = false;
            }

            for (var key in this.currentCalls) {
                if (this.currentCalls[key]['pc'] !== null) {
                    this.unsubscribePC(this.currentCalls[key]['pc']);
                    this.currentCalls[key]['pc'].close();
                    this.currentCalls[key]['pc'] = null;
                }
            }

            if (this.pc !== null) {
                if (this.pc.signalingState !== 'closed') {
                    this.pc.close();
                }
                this.pc = null;
            }

            if (this.closeTimeout !== null) clearTimeout(this.closeTimeout);

        },

        doForceCloseXimssSession: function () {

            if (DEBUG_SIPNET === true) console.log('closing session...');
            if (this.theSession !== null) {
                this.theSession.close(ximssSession, this.finalCallback);
                this.theSession = null;
                this.logined = false;
            }

            for (var key in this.currentCalls) {
                if (this.currentCalls[key]['pc'] !== null) {
                    this.unsubscribePC(this.currentCalls[key]['pc']);
                    this.currentCalls[key]['pc'].close();
                    this.currentCalls[key]['pc'] = null;
                }
            }

            if (this.pc !== null) {
                if (this.pc.signalingState !== 'closed') {
                    this.pc.close();
                }
                this.pc = null;
            }

            if (this.closeTimeout !== null) clearTimeout(this.closeTimeout);

            this.onXimssForceClosed();
        },


        doMonitorCalls: function (callUUID, monType) {
            if (this.theSession !== null) {
                var sendTaskSendEventRequest = this.theSession.createXMLNode("taskSendEvent");
                sendTaskSendEventRequest.setAttribute("eventName", "monitor");
                sendTaskSendEventRequest.setAttribute("taskRef", this.hubTaskReferer);

                var subKey1 = this.theSession.createXMLNode('subKey');
                subKey1.setAttribute("key", "UUID");
                subKey1.appendChild(this.theSession.createTextNode(callUUID));

                var subKey2 = this.theSession.createXMLNode('subKey');
                subKey2.setAttribute("key", "type");
                subKey2.appendChild(this.theSession.createTextNode(monType));

                sendTaskSendEventRequest.appendChild(subKey1);
                sendTaskSendEventRequest.appendChild(subKey2);

                this.theSession.sendRequest(sendTaskSendEventRequest, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        doSetClientName:function (name) {
            if (this.theSession !== null) {
                var sendSetClientName = this.theSession.createXMLNode("setClientName");
                sendSetClientName.setAttribute("name", name);
                this.theSession.sendRequest(sendSetClientName, this, this.ximssDataCallback, this.ximssOpCompleted, true);
            }
        },

        ximssAsyncAll: function (xmlData) {
            if (this.theSession !== null) {

                var logString = (new XMLSerializer()).serializeToString(xmlData);

                logString = logString.replace(new RegExp("<CallMelody>(.*)<\/CallMelody>", 'g'), '...');
                logString = logString.replace(new RegExp("<BINVAL>(.*)<\/BINVAL>", 'g'), '...');
                logString = logString.replace(new RegExp("<base64>(.*)<\/base64>", 'g'), '...');

                if (DEBUG_SIPNET === true) console.log("%cS: " + logString, "color:blue;");

                if (xmlData === null) return;
                var tagName = xmlData.tagName.toLowerCase();


                if (tagName === "rosteritem") {
                    var peerName = xmlData.getAttribute('name');
                    var peer = xmlData.getAttribute('peer');
                    var subscription = xmlData.getAttribute('subscription');

                    var groups = [];

                    for (var i = 0; i < xmlData.childNodes.length; ++i) {
                        if (xmlData.childNodes[i].tagName === 'group') {
                            groups.push(xmlData.childNodes[i].textContent);
                        }
                    }

                    if (DEBUG_SIPNET === true) console.log('Peer: ' + peer + ' ' + subscription + ' ' + groups);
                    if (peer !== null) {
                        this.onXimssRosterItem(peerName, peer, groups, subscription);
                    }
                }

                if (tagName === "session") {
                    this.urlID = xmlData.getAttribute('urlID');
                    this.CGPversion = xmlData.getAttribute('version');
                    this.onXimssSessionID(this.urlID);
                    this.doStat();
                    var base26lastOctet='';
                    var arr_serverLink = this.urlID.match(/-.*-(.*)/);
                    if (arr_serverLink !== null) {

                        if (DEBUG_SIPNET === true) console.log('arr_serverLink',arr_serverLink);
                        base26lastOctet = this.toInt26(arr_serverLink[1]);
                        this.serverName = 'h'+base26lastOctet+'n40.sub.tario.ru';
                        this.theSession.setServerName(this.serverName);
                    }
                }

                if (tagName === "taskevent") {

                    var eventName = xmlData.getAttribute('eventName');

                    if (eventName === 'conflict') {
                        this.conflict = true;
                        this.onConflict();
                    }

                    if (eventName === 'rcall') {
                        var strangerTaskRef = xmlData.getAttribute("taskRef");

                        if (this.currentCalls !== null && Object.keys(this.currentCalls).length > 0) {
                            this.doXimssSendEvent('rcallbusy', null, strangerTaskRef);
                        } else {
                            this.onAutoCall(xmlData.textContent, 1);
                            this.doXimssSendEvent('rcallstarted', null, strangerTaskRef);
                        }
                    }

                    if (eventName === 'display') {
                        var groupName;
                        var realName;
                        var phone;

                        for (var i = 0; i < xmlData.childNodes.length; ++i) {
                            var key = xmlData.childNodes[i].getAttribute('key');
                            var xmlKey = xmlData.childNodes[i];
                            if (key === "@groupName") {
                                groupName = xmlKey.textContent;
                            }
                            if (key === "@realName") {
                                realName = xmlKey.textContent;
                            }
                            if (key === "") {
                                phone = xmlKey.textContent;
                            }
                        }
                        if (DEBUG_SIPNET === true) console.log("onDisplayEvent: " + realName + " " + groupName + " " + phone);
                        this.onDisplayEvent(realName, groupName, phone);
                    }


                    if (eventName === 'settings') {
                        for (var i = 0; i < xmlData.childNodes.length; ++i) {
                            var key = xmlData.childNodes[i].getAttribute('key');
                            var xmlKey = xmlData.childNodes[i];
                            if (key === 'integration') {
                                if (DEBUG_SIPNET === true) console.log(xmlKey.textContent);
                                this.onIntegration(xmlKey.textContent);
                            }
                        }
                    }

                    if (eventName === 'cg-card') {

                        var xmlDataStr = this.xml2str(xmlData);

                        xmlDataStr = xmlDataStr.replace('{login}', this.userName);
                        xmlDataStr = xmlDataStr.replace('{sessionid}', this.urlID);

                        var xmlDataXml = this.str2xml(xmlDataStr);

                        this.onCgCardEvent(xmlDataXml);
                        if (DEBUG_SIPNET === true) console.log("CG-Card: " + (new XMLSerializer()).serializeToString(xmlDataXml));
                    }

                    if (eventName === 'groupsinfo') {
                        this.hubTaskReferer = xmlData.getAttribute('taskRef');
                        this.onGroupsInfoEvent(xmlData);
                        if (DEBUG_SIPNET === true) console.log("GroupsInfo: " + (new XMLSerializer()).serializeToString(xmlData));
                    }

                    if (eventName === 'groupslist') {
                        this.hubTaskReferer = xmlData.getAttribute('taskRef');
                        this.onGroupsListEvent(xmlData);
                        if (DEBUG_SIPNET === true) console.log("GroupsList: " + (new XMLSerializer()).serializeToString(xmlData));
                    }

                    if (eventName === 'status') {
                        this.onStatusEvent(xmlData);
                        if (DEBUG_SIPNET === true) console.log("status: " + (new XMLSerializer()).serializeToString(xmlData));
                    }

                    if (eventName === 'welcome') {
                        this.hubTaskReferer = xmlData.getAttribute('taskRef');

                        var serverLink = xmlData.firstChild.nodeValue;

                        this.onWelcome();
                    }

                    if (eventName === 'userslist') {
                        this.onGroupsInfoEvent(xmlData);
                    }

                    if (eventName === 'userinfo') {
                        this.onGroupsInfoEvent(xmlData);
                    }

                    if (eventName === 'rcallstarted' || eventName === 'rcallbusy') {
                        this.onRcallEvent(eventName);
                    }

                    if (eventName === 'crm-link') {

                        var linkString = xmlData.firstChild.nodeValue;
                        var origLink = xmlData.firstChild.nodeValue;

                        linkString = linkString.replace('{login}', this.userName);
                        linkString = linkString.replace('{sessionid}', this.urlID);

                        if (DEBUG_SIPNET === true) console.log("CRM-link: " + linkString);
                        this.onCrmLinkEvent(linkString, origLink);
                    }

                    if (eventName === 'update_context') {
                        this.onXimssUpdateContext();
                    }

                    if (eventName === 'cgcardsearch' || eventName === 'delcgcard' || eventName === 'getcgcard' || eventName === 'cgcard' || eventName === 'cgcard-close') {
                        this.onNewCGCard(xmlData);
                    }

                }

                if (tagName === "readim" && this.onXimssReadIM) {
                    var peer = xmlData.getAttribute('peer'),
                        peerName = xmlData.getAttribute('peerName'),
                        type = xmlData.getAttribute('type'),
                        body = xmlData.firstChild;

                    if (DEBUG_SIPNET === true) console.log("readIM: " + (new XMLSerializer()).serializeToString(xmlData));

                    if (body.tagName.toLowerCase() === 'body') {
                        var message = body.firstChild.nodeValue;

                        var card_match = [];
                        card_match = message.match(/номером\s(\d+)\./);

                        var card_match2 = [];
                        card_match2 = message.match(/ссылка\s(.*)\.\sИспользуйте/);

                        if (card_match !== null && card_match.length > 0) {

                            if (DEBUG_SIPNET === true) console.log("Received CG-Gard: " + card_match[1]);
                            this.onXimssReceiveCgCardId(peer, peerName, card_match[1]);
                        } else if (card_match2 !== null && card_match2.length > 0) {

                            var linkString = card_match2[1];
                            var origLink = card_match2[1];

                            linkString = linkString.replace('{login}', this.userName);
                            linkString = linkString.replace('{sessionid}', this.urlID);

                            if (DEBUG_SIPNET === true) console.log("Received CRM-link: " + origLink + " final link: " + linkString);
                            this.onXimssReceiveCRMlink(peer, peerName, linkString, origLink);
                        } else {
                            if (peer === "pbx@" + this.serverName) {
                                var linkString = message;
                                var origLink = message;

                                linkString = linkString.replace('{login}', this.userName);
                                linkString = linkString.replace('{sessionid}', this.urlID);

                                if (DEBUG_SIPNET === true) console.log("!!!Received CRM-link from IM but not shown!!!: " + origLink + " final link: " + linkString);
                            } else {
                                this.onXimssReadIM(peer, peerName, message);
                            }

                        }
                    } else if (body.tagName.toLowerCase() === 'composing') {
                        if (DEBUG_SIPNET === true) console.log('.....composing.....');
                        this.doXimssFileWriteDelivery(peer);
                        this.onXimssReadIMComposing(peer, peerName);
                    } else if (body.tagName.toLowerCase() === 'gone') {
                        if (DEBUG_SIPNET === true) console.log('.....gone......');
                        this.onXimssReadIMGone(peer, peerName);
                    }

                }

                if (tagName === "callprovisioned") {

                    var sdpTextNode;

                    for (var i = 0; i < xmlData.childNodes.length; ++i) {
                        sdpTextNode = xmlData.childNodes[i];
                        if (sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) break;
                    }

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;

                        }
                    }

                    if (this.currentCalls[callId] === undefined) return;

                    if (this.currentCalls[callId]['sdp'] === undefined) this.currentCalls[callId]['sdp'] = new Array();

                    var mediaTag = xmlData.getAttribute('tag');

                    if (sdpTextNode !== null && sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) {


                        if (this.isSdpText === true) {
                            this.currentCalls[callId]['sdp'][mediaTag] = sdpTextNode.firstChild.nodeValue;
                        } else {
                            this.currentCalls[callId]['sdp'][mediaTag] = this.fixCGSDPStr(SDPXML.getText(SDPXML.adjustServerXML(sdpTextNode)));
                            if (DEBUG_SIPNET === true) console.log("TextSDP: " + this.currentCalls[callId]['sdp'][mediaTag]);
                        }

                        this.doCallUpdateAccept(callId);
                    } else {
                        this.doCallUpdateAccept(callId);
                        if (DEBUG_SIPNET === true) console.log("callProvisioned: no SDP");
                    }

                    createLocalKPV();
                    if (this.onXimssCallProvisioned) this.onXimssCallProvisioned(callId);
                }


                if (tagName === "callincoming") {

                    var sdpTextNode;
                    var answerAfter = false;

                    for (var i = 0; i < xmlData.childNodes.length; ++i) {
                        sdpTextNode = xmlData.childNodes[i];
                        if (sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) break;
                    }

                    for (var i = 0; i < xmlData.childNodes.length; ++i) {
                        if (xmlData.childNodes[i].tagName.toLowerCase() === 'suppl') {
                            var suppl = xmlData.childNodes[i];
                            for (var j = 0; j < suppl.childNodes.length; ++j) {
                                var subKey = suppl.childNodes[j];
                                var key = subKey.getAttribute('key');

                                if (key === 'Alert-Info') {
                                    if (DEBUG_SIPNET === true) console.log("It's the monitor call!");
                                    if (subKey.firstChild.nodeValue === 'answer-after=0') answerAfter = true;
                                }

                            }

                        }
                    }


                    var callLeg = xmlData.getAttribute('callLeg');
                    var peerName = xmlData.getAttribute('peerName');
                    var peer = xmlData.getAttribute('peer');
                    var cid = xmlData.getAttribute('callId');

                    if (this.currentCalls !== null && Object.keys(this.currentCalls).length > 0 || (answerAfter === true && this.userStatus !== 'admin') || (answerAfter === false && this.userStatus === 'admin' && this.widget === false)) {

                        var provisionCallResponse = this.theSession.createXMLNode("callProvision");
                        provisionCallResponse.setAttribute("callLeg", callLeg);
                        this.theSession.sendRequest(provisionCallResponse, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);

                        var callRejectResponse = this.theSession.createXMLNode("callReject");
                        callRejectResponse.setAttribute("callLeg", callLeg);
                        callRejectResponse.setAttribute("signalCode", '486');
                        this.theSession.sendRequest(callRejectResponse, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);

                    } else {

                        if (this.currentCalls === null) this.currentCalls = new Array();
                        this.currentCalls[1] = new Array();
                        this.currentCalls[1]['peer'] = peer;
                        this.currentCalls[1]['callLeg'] = callLeg;
                        this.currentCalls[1]['isHold'] = false;
                        if (sdpTextNode !== null && sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) {
                            if (this.isSdpText === true) {
                                this.currentCalls[1]['remoteSDP'] = sdpTextNode.firstChild.nodeValue;
                            } else {
                                this.currentCalls[1]['remoteSDP'] = this.fixCGSDPStr(SDPXML.getText(SDPXML.adjustServerXML(sdpTextNode)));
                            }
                        }

                        var provisionCallResponse = this.theSession.createXMLNode("callProvision");
                        provisionCallResponse.setAttribute("callLeg", callLeg);

                        this.theSession.sendRequest(provisionCallResponse, ximssSession, this.ximssDataCallback, this.ximssOpCompleted, true);

                        if (sdpTextNode !== undefined){
                            if (this.isSdpText === true) {
                                var sdpText = sdpTextNode.firstChild.nodeValue;
                            } else {
                                var sdpText = this.fixCGSDPStr(SDPXML.getText(SDPXML.adjustServerXML(sdpTextNode)));
                                if (DEBUG_SIPNET === true) console.log("TextSDP: " + sdpText);
                            }


                            if (sdpText.indexOf("m=video") !== -1) {
                                this.incomingWithVideo = true;
                            } else {
                                this.incomingWithVideo = false;
                            }
                        }
                        if (this.onXimssCallIncoming) this.onXimssCallIncoming(peer, peerName, this.incomingWithVideo, cid);
                    }

                }
                if (tagName === "callconnected") {
                    deleteLocalKPV();


                    var sdpTextNode;

                    for (var i = 0; i < xmlData.childNodes.length; ++i) {
                        sdpTextNode = xmlData.childNodes[i];
                        if (sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) break;
                    }

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;

                        }
                    }

                    if (this.currentCalls[callId] === undefined) return;

                    if (this.currentCalls[callId]['sdp'] === undefined) this.currentCalls[callId]['sdp'] = new Array();


                    var mediaTag = xmlData.getAttribute('tag');

                    if (sdpTextNode !== null && sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) {

                        if (this.isSdpText === true) {
                            this.currentCalls[callId]['sdp'][mediaTag] = sdpTextNode.firstChild.nodeValue;
                        } else {
                            this.currentCalls[callId]['sdp'][mediaTag] = this.fixCGSDPStr(SDPXML.getText(SDPXML.adjustServerXML(sdpTextNode)));
                            if (DEBUG_SIPNET === true) console.log("TextSDP: " + this.currentCalls[callId]['sdp'][mediaTag]);
                        }


                        var remoteSDP = this.currentCalls[callId]['sdp'][mediaTag];
                        this.currentCalls[callId]['sdp']['currentTag'] = mediaTag;
                        this.remoteSDPRecived(remoteSDP, callId);

                        var videoSDP = '';
                        var withVideo = false;
                        var indexVideo = remoteSDP.indexOf('m=video');
                        if (indexVideo !== -1) {
                            videoSDP = remoteSDP.substring(indexVideo);
                            var directionVideoSR = videoSDP.indexOf('a=sendrecv');
                            if (directionVideoSR > -1) {
                                withVideo = true;
                            } else {
                                withVideo = false;
                            }
                        }

                    } else {

                        if (this.currentCalls[callId]['sdp'][mediaTag] === undefined) {
                            if (DEBUG_SIPNET === true) console.log("CallConnected: no SDP, enjoy the silence...");
                        } else {
                            var remoteSDP = this.currentCalls[callId]['sdp'][mediaTag];
                            this.currentCalls[callId]['sdp']['currentTag'] = mediaTag;
                            this.remoteSDPRecived(remoteSDP, callId);
                        }

                    }

                    this.doCallUpdateAccept(callId);
                    if (DEBUG_SIPNET === true) console.log('Answer with video: ' + withVideo);
                    if (this.onXimssCallConnected) this.onXimssCallConnected(callId, withVideo);
                }

                if (tagName === "callupdated") {
                    /*
                    - Когда принимается входящий звонок, Клиент может послать:
                    ноль, один или несколько запросов callProvision. Для каждого запроса callProvision Сервер присылает сообщение callUpdated.

                    - Когда звонок установлен, Клиент может прислать:
                    ноль, один или несколько запросов callUpdate. Для каждого запроса callUpdate Сервер присылает сообщение callUpdated.
                    */

                    var sdpTextNode;

                    for (var i = 0; i < xmlData.childNodes.length; ++i) {
                        sdpTextNode = xmlData.childNodes[i];
                        if (sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) break;
                    }

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;

                        }
                    }

                    var updateSignalCode = xmlData.getAttribute('signalCode');
                    var updateErrorText = xmlData.getAttribute('errorText');


                    if (updateSignalCode !== null) {
                        if (this.onXimssCallUpdatedError) this.onXimssCallUpdatedError(this.currentCalls[callId]['isHold'], callId, updateSignalCode, updateErrorText);
                        return;
                    }

                    if (sdpTextNode !== null && sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) {
                        var remoteSDP;

                        if (this.isSdpText === true) {
                            remoteSDP = sdpTextNode.firstChild.nodeValue;
                        } else {
                            remoteSDP = this.fixCGSDPStr(SDPXML.getText(SDPXML.adjustServerXML(sdpTextNode)));
                            if (DEBUG_SIPNET === true) console.log("TextSDP: " + remoteSDP);
                        }

                        this.remoteSDPRecived(remoteSDP, callId);
                    } else {
                        if (this.currentCalls[callId] !== undefined) {
                            if (this.currentCalls[callId]['pc'] !== undefined) {
                                if (this.currentCalls[callId]['pc'].signalingState === 'have-local-offer') {
                                    if (this.currentCalls[callId]['sdp'] !== undefined) {
                                        var mediaTag = this.currentCalls[callId]['sdp']['currentTag'];
                                        var remoteSDP = this.currentCalls[callId]['sdp'][mediaTag];
                                        this.remoteSDPRecived(remoteSDP, callId);
                                    } else {
                                        var remoteSDP = this.currentCalls[callId]['remoteSDP'];
                                        this.remoteSDPRecived(remoteSDP, callId);
                                    }
                                }
                                if (DEBUG_SIPNET === true) console.log('PEER STATE ' + this.currentCalls[callId]['pc'].signalingState);
                            }
                        }


                        if (DEBUG_SIPNET === true) console.log("No SDP with callUpdated.");
                    }

                    if (this.currentCalls[callId] !== undefined) {
                        if (this.onXimssCallUpdated) this.onXimssCallUpdated(this.currentCalls[callId]['isHold'], callId);
                    }
                }

                if (tagName === "callupdaterequest") {
                    var sdpTextNode;

                    for (var i = 0; i < xmlData.childNodes.length; ++i) {
                        sdpTextNode = xmlData.childNodes[i];
                        if (sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) break;
                    }

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;
                        }
                    }

                    if (sdpTextNode !== null && sdpTextNode.tagName.toLowerCase() === this.xmlSdp.toLowerCase()) {
                        var remoteSDP;

                        if (this.isSdpText === true) {
                            remoteSDP = sdpTextNode.firstChild.nodeValue;
                            this.currentCalls[callId]['remoteSDP'] = sdpTextNode.firstChild.nodeValue;
                        } else {
                            remoteSDP = this.fixCGSDPStr(SDPXML.getText(SDPXML.adjustServerXML(sdpTextNode)));
                            this.currentCalls[callId]['remoteSDP'] = remoteSDP;
                            if (DEBUG_SIPNET === true) console.log("TextSDP: " + remoteSDP);
                        }


                        var isSendonly = remoteSDP.indexOf('a=sendonly');
                        var isInactive = remoteSDP.indexOf('a=inactive');
                        var isMoh = remoteSDP.indexOf('a=x-moh');

                        var isHold = false;
                        var status = '';

                        if (isSendonly !== -1 || isInactive !== -1) {
                            if (isSendonly !== -1 || isMoh !== -1) {
                                status = 'sendonly';
                            }
                            if (isInactive !== -1) {
                                status = 'inactive';
                            }
                            isHold = true;
                        }

                        this.onXimssOnHold(isHold, status);

                    } else {
                        if (DEBUG_SIPNET === true) console.log("No SDP with callUpdateRequest");
                        return;
                    }
                    this.doUpdateRequestAccept(callId, 'offer');
                }


                if (tagName === "calldisconnected") {
                    var errorText = xmlData.getAttribute('errorText');
                    var cLeg = xmlData.getAttribute('callLeg');
                    deleteLocalKPV();

                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === cLeg) {
                            callId = key;

                        }
                    }

                    if (callId !== '') {
                        this.doCallKill(callId);
                        if (this.onXimssCallDisconnected) this.onXimssCallDisconnected(errorText, callId);
                    }


                }
                if (tagName === "presence" && this.onXimssPresence) {
                    var peer = xmlData.getAttribute('peer');
                    var presenseType = xmlData.getAttribute('type');
                    var statusShow, statusPresence;

                    if (presenseType !== 'unavailable') {
                        for (var i = 0; i < xmlData.childNodes.length; ++i) {
                            var presenceNodes = xmlData.childNodes[i];

                            if (presenceNodes.tagName === 'show') {
                                statusShow = presenceNodes.firstChild.nodeValue;
                            }
                            if (presenceNodes.tagName === 'presence') {
                                statusPresence = presenceNodes.firstChild.nodeValue;
                            }
                            if (presenceNodes.tagName === 'x') {
                                var xmlns = presenceNodes.getAttribute('xmlns');
                                if (xmlns === 'jabber:iq:avatar') {
                                    var hashNode = presenceNodes.firstChild;
                                    if (hashNode.firstChild !== null)
                                        var photoHash = hashNode.firstChild.nodeValue;
                                }
                            }

                        }
                    } else {
                        statusShow = 'offline';
                        statusPresence = 'offline';
                    }

                    if (DEBUG_SIPNET === true) console.log('presence for ' + peer + ' : show:' + statusShow + ' presence:' + statusPresence + ' hash: ' + photoHash);
                    this.onXimssPresence(peer, statusShow, statusPresence, photoHash);
                }

                if (tagName === "makecallreport") {
                    var reportText = null;
                    if (xmlData.firstChild !== null) reportText = xmlData.firstChild.nodeValue;
                    this.onXimssMakeCallReport(reportText);
                }

                if (tagName === "callopfailed") {
                    var errorText = xmlData.getAttribute('errorText');
                    var signalCode = xmlData.getAttribute('signalCode');

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;
                        }
                    }

                    this.onXimssCallOpFailed(errorText, signalCode, callId);
                }
                if (tagName === "callopcompleted") {

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;
                        }
                    }
                    this.onXimssCallOpCompleted(callId);
                }

                if (tagName === "iqread") {
                    var peer = xmlData.getAttribute('peer');
                    var xmlVCard = xmlData.firstChild;

                    var vCardJSON = vCardUtil.getVCard(xmlVCard);

                    var self = this;
                    vCardUtil.getPhotoData(xmlVCard, function (data) {
                        self.onIqRead(peer, vCardJSON, data);
                    });
                }

                if (tagName === "folderreport") {
                    var folder = xmlData.getAttribute('folder');
                    var mode = xmlData.getAttribute('mode');
                    var uid = xmlData.getAttribute('UID');

                    if (mode === "notify") {
                        this.doXimssFolderSync(folder);
                    }
                }
            }

        },

        ximssAsyncSession: function (xmlData) {
            if (DEBUG_SIPNET === true) console.log("ximssAsyncSession: " + (new XMLSerializer()).serializeToString(xmlData));
        },


        ximssNetworkErrorProcessor: function (isFatal, timeElapsed) {

            if (DEBUG_SIPNET === true) console.log("network error" + isFatal + " " + timeElapsed);
            this.onNetworkError(isFatal, timeElapsed);

            if (isFatal === true) {
                if (DEBUG_SIPNET === true) console.log('doLogout if ximssNetworkErrorProcessor');
                this.doForceCloseXimssSession();
            }
        },

        ximssNetworkOKProcessor: function () {
            if (DEBUG_SIPNET === true) console.log("network ok");
            this.onNetworkOk();
        },

        ximssOpCompleted: function (errorCode, xmlData) {
            if (this.theSession !== null) {
                var errorTemp;
                if (errorCode === null) {
                    errorTemp = 'Ok';

                    var logString = (new XMLSerializer()).serializeToString(xmlData);

                    logString = logString.replace(new RegExp("<CallMelody>(.*)<\/CallMelody>", 'g'), '...');
                    logString = logString.replace(new RegExp("<BINVAL>(.*)<\/BINVAL>", 'g'), '...');
                    logString = logString.replace(new RegExp("<base64>(.*)<\/base64>", 'g'), '...');

                    if (DEBUG_SIPNET === true) console.log("ximssOpCompleted: %c" + errorTemp + '\n%cC: ' + logString, "color:green;", "color:orange;");
                } else {
                    if (errorCode === 'meeting is already activated') {
                        this.onConflict();
                    }
                    if (errorCode === 'file is not found') {

                        if (xmlData === null) return;

                        var tagName = xmlData.tagName.toLowerCase();
                        if (tagName === "fileread") {
                            var fileName = xmlData.getAttribute("fileName");
                        }

                        this.onFileNotFound(fileName);
                    }
                    if (errorCode === 'illegal vCard data format') {
                        this.onvCardFail();
                    }
                    if (errorCode === 'mailbox access denied') {
                        this.onMailBoxAccessError();
                    }

                    if (errorCode === 'async Object not found') {
                        var tagName = xmlData.tagName.toLowerCase();
                        var eventName = xmlData.getAttribute('eventName');

                        if (tagName === "tasksendevent" && eventName === "rcall") {
                            this.isCallPending = true;
                            this.doXimssFindTaskMeeting('pbx', 'agent');
                        }

                        var tagName = xmlData.tagName.toLowerCase();
                        if (DEBUG_SIPNET === true) console.log(tagName);
                    }

                    errorTemp = errorCode;

                    var logString = (new XMLSerializer()).serializeToString(xmlData);

                    logString = logString.replace(new RegExp("<CallMelody>(.*)<\/CallMelody>", 'g'), '...');
                    logString = logString.replace(new RegExp("<BINVAL>(.*)<\/BINVAL>", 'g'), '...');
                    logString = logString.replace(new RegExp("<base64>(.*)<\/base64>", 'g'), '...');

                    if (DEBUG_SIPNET === true) console.log("ximssOpCompleted: %c" + errorTemp + '\n%cC: ' + logString, "color:red;", "color:orange;");

                    switch(errorTemp){
                        case "meeting is already activated": break;
                        case "file is not found": break;
                        case "illegal vCard data format": break;
                        case "async Object not found": break;
                        case "folder has already been opened": break;
                        case "folder has not been opened": break;
                        case "meeting not found": break;
                        default:
                            if(Raven) Raven.captureException(errorTemp);
                    }
                }

                if (xmlData === null) return;

                var tagName = xmlData.tagName.toLowerCase();


                if (tagName === "callreject") {
                    if (DEBUG_SIPNET === true) console.log("Delete call line: " + this.rejectId);
                    delete this.currentCalls[this.rejectId];
                }

                if (tagName === "signalbind") {
                    var xmlStr = (new XMLSerializer()).serializeToString(xmlData);
                    if (xmlStr.indexOf("o=- 1 2 IN IP4 127.0.0.1") !== -1) {
                        this.onXimssSignalBindForDevice();
                        if (DEBUG_SIPNET === true) console.log("onXimssSignalBindForDevice");
                    } else {
                        if (DEBUG_SIPNET === true) console.log("onXimssSignalBind");
                        this.onXimssSignalBind();

                        if (this.localStream !== null) {

                            this.localStream.getAudioTracks()[0].stop();
                            if (this.localStream.getVideoTracks()[0] !== undefined)
                                this.localStream.getVideoTracks()[0].stop();

                            if (this.ifFirefox === true) {

                            } else {

                                this.pc.removeStream(this.localStream);
                            }
                        }

                    }

                    if (this.isPresence === true) {
                        this.doRosterList();
                        this.doPresenceSet("online");
                    }

                }

                if (tagName === "filewrite") {
                    this.onXimssFileWrite();
                }

                if (tagName === "taskfindmeeting") {
                    if (errorCode === 'meeting not found') {
                        if (xmlData.getAttribute("meetingName") === 'agent' && this.widget === true) {
                            this.agentReferer = null;
                            this.onPMOfind();
                            return;
                        }
                        this.userStatus === 'admin' ?
                            this.doXimssTaskCreateMeeting('pbx', this.adminKey) :
                            this.doXimssTaskCreateMeeting('pbx', this.userStatus);
                    }
                }

                if (tagName === "taskcreatemeeting" || tagName === "taskclearmeeting") {
                    if (errorCode === null) {
                        this.userStatus === 'admin' ?
                            this.doXimssTaskActivateMeeting('pbx', this.adminKey) :
                            this.doXimssTaskActivateMeeting('pbx', this.userStatus);
                    }
                }

                if (tagName === "taskdeactivatemeeting") {
                    this.userStatus === 'admin' ?
                        this.doXimssTaskRemoveMeeting('pbx', this.adminKey) :
                        this.doXimssTaskRemoveMeeting('pbx', this.userStatus);
                    this.doCloseXimssSession();
                }

                if (tagName === "taskactivatemeeting") {
                    if (this.userStatus === 'admin' && this.widget === true) {
                        this.doXimssSendMsg('hub@sipnet.ru', 'chat', "{cmd=subscribe;key=" + this.adminKey + ";widget=amoCRM;}");
                    } else if (this.userStatus === 'admin' && this.widget === false) {
                        this.doXimssSendMsg('hub@sipnet.ru', 'chat', "{cmd=subscribe;key=" + this.adminKey + ";}");
                    } else {
                        this.doXimssSendMsg('hub@sipnet.ru', 'chat', "{cmd=register;}");
                    }

                }


                if (tagName === "tasksendevent") {

                    var eventName = xmlData.getAttribute('eventName');

                    if (eventName === 'conflict') {
                        this.userStatus === 'admin' ?
                            this.doXimssTaskClearMeeting('pbx', this.adminKey) :
                            this.doXimssTaskClearMeeting('pbx', this.userStatus);
                    }

                    if (eventName === 'agent-bye') {
                        if (this.conflict === false) {
                            this.userStatus === 'admin' ?
                                this.doXimssTaskDeactivateMeeting('pbx', this.adminKey) :
                                this.doXimssTaskDeactivateMeeting('pbx', this.userStatus);
                        } else {
                            if (DEBUG_SIPNET === true) console.log('agent-bye');
                            this.doCloseXimssSession();
                        }
                    }

                    if (eventName === 'admin-bye') {
                        if (this.conflict === false) {
                            this.userStatus === 'admin' ?
                                this.doXimssTaskDeactivateMeeting('pbx', this.adminKey) :
                                this.doXimssTaskDeactivateMeeting('pbx', this.userStatus);
                        } else {
                            if (DEBUG_SIPNET === true) console.log('admin-bye');
                            this.doCloseXimssSession();
                        }
                    }
                    this.onXimssTaskSendEvent(eventName);
                }

                if (tagName === "makecall") {
                    var peer = xmlData.getAttribute('peer');
                }

                if (tagName === "calltransfer") {
                    this.onXimssCallTransfer();
                }

                if (tagName === "callaccept") {


                    if (callLeg === "") return;

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;
                        }
                    }


                    let isMediaProxied=false;


                    if(this.currentCalls[callId]['remoteSDP'].indexOf('c=IN IP4 212.53.40')>0){
                        isMediaProxied=true;
                    }else{
                        isMediaProxied=false;
                    }

                    //if (this.onXimssCallAccept) this.onXimssCallAccept(callId, isMediaProxied);
                }
                if (tagName === "callupdateaccept") {


                    if (callLeg === "") return;

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;
                        }
                    }

                    let isMediaProxied=false;

                    if(this.currentCalls[callId]['remoteSDP']!==undefined){
                        if(this.currentCalls[callId]['remoteSDP'].indexOf('c=IN IP4 212.53.40')>0){
                            isMediaProxied=true;
                        }else{
                            isMediaProxied=false;
                        }
                    }



                    var media = xmlData.getAttribute('media');
                    if(media==='WebRTC')
                        if (this.onXimssCallUpdateAccept) this.onXimssCallUpdateAccept(isMediaProxied);
                }

                if (tagName === "callredirect") {
                    deleteLocalKPV();
                    if (callLeg === "") return;

                    var callLeg = xmlData.getAttribute('callLeg');
                    var callId = '';

                    for (var key in this.currentCalls) {
                        if (this.currentCalls[key]['callLeg'] === callLeg) {
                            callId = key;
                        }
                    }

                    var self = this;

                    if (this.currentCalls[callId]['pc'] !== null) {

                        if (this.ifFirefox === true) {

                            if (this.currentCalls[callId]['pc'].signalingState === 'stable') {

                                this.currentCalls[callId]['pc'].getSenders().forEach(function (sender) {
                                    self.currentCalls[callId]['localStream'].getTracks().forEach(function (track) {
                                        if (sender.track === track) {
                                            self.currentCalls[callId]['pc'].removeTrack(sender);
                                            if (DEBUG_SIPNET === true) console.log('removeTrack');
                                        }
                                    });
                                });

                            }
                        } else {
                            this.currentCalls[callId]['pc'].removeStream(this.currentCalls[callId]['localStream']);
                        }


                        if (this.currentCalls[callId]['pc'] !== null) {
                            this.unsubscribePC(this.currentCalls[callId]['pc']);
                            this.currentCalls[callId]['pc'].close();
                            this.currentCalls[callId]['pc'] = null;
                        }


                    }
                    if (this.currentCalls[callId]['localStream'] !== null) {
                        this.currentCalls[callId]['localStream'].getAudioTracks()[0].stop();
                        if (this.currentCalls[callId]['localStream'].getVideoTracks()[0] !== undefined)
                            this.currentCalls[callId]['localStream'].getVideoTracks()[0].stop();
                    }
                    this.currentCalls[callId]['dtmfSender'] = null;
                    delete this.currentCalls[callId];
                }
            }

        },

        unsubscribePC: function (pcToUs) {
            if (DEBUG_SIPNET === true) console.info(pcToUs);
            pcToUs.onicecandidate = null;
            pcToUs.oniceconnectionstatechange = null;
            pcToUs.onnegotiationneeded = null;
            pcToUs.onaddstream = null;
            pcToUs.onremovestream = null;
            pcToUs.onsignalingstatechange = null;
        },

        ximssDataCallback: function (xmlResponse, xmlData) {
            if (this.theSession !== null) {

                var self = this;

                var logString = (new XMLSerializer()).serializeToString(xmlResponse);

                logString = logString.replace(new RegExp("<CallMelody>(.*)<\/CallMelody>", 'g'), '...');
                logString = logString.replace(new RegExp("<BINVAL>(.*)<\/BINVAL>", 'g'), '...');
                logString = logString.replace(new RegExp("<base64>(.*)<\/base64>", 'g'), '...');

                if (DEBUG_SIPNET === true) console.log("%cS: " + logString, "color:blue;");


                if (xmlResponse === null) return;

                var tagName = xmlResponse.tagName.toLowerCase();


                if (tagName === "filedata") {
                    var fileName = xmlResponse.getAttribute("fileName");
                    var type = xmlResponse.getAttribute("type");

                    var fileData = xmlResponse.firstChild;

                    if (type === "vcard") {
                        var xmlVCard = xmlResponse.firstChild;
                        var myContact = new Contact();
                        myContact.vCardXML = xmlVCard;

                        myContact.updateFromVCard(function () {
                            self.onXimssMyContact(type, fileName, myContact);
                        });
                    } else {
                        this.onXimssFileData(type, fileName, fileData);
                    }

                }

                if (tagName === "fileinfo") {
                    var fileName = xmlResponse.getAttribute("fileName");
                    var size = xmlResponse.getAttribute("size");
                    var timeModified = xmlResponse.getAttribute("timeModified");
                    var directory = xmlResponse.getAttribute("directory");

                    this.onXimssFileList(fileName, size, timeModified, directory);
                }


                if (tagName === "taskmeeting") {
                    if (xmlResponse.getAttribute("meetingName") === 'agent' && this.widget === true) {
                        this.agentReferer = xmlResponse.getAttribute("taskRef");
                        this.onPMOfind();
                        return;
                    }

                    this.taskReferer = xmlResponse.getAttribute("taskRef");

                    if (this.taskReferer !== null) {
                        this.doXimssSendEvent('conflict', null, this.taskReferer);
                    } else {
                        this.userStatus === 'admin' ?
                            this.doXimssTaskClearMeeting('pbx', this.adminKey) :
                            this.doXimssTaskClearMeeting('pbx', this.userStatus);
                    }

                }

                if (tagName === "cliresult") {
                    var cliResult = xmlResponse.firstChild;
                    this.onXimssCliResult(cliResult);
                }

                if (tagName === "rosteritem") {
                    var peerName = xmlResponse.getAttribute('name');
                    var peer = xmlResponse.getAttribute('peer');
                    var subscription = xmlResponse.getAttribute('subscription');


                    var groups = [];

                    for (var i = 0; i < xmlResponse.childNodes.length; ++i) {
                        if (xmlResponse.childNodes[i].tagName === 'group') {
                            groups.push(xmlResponse.childNodes[i].textContent);
                        }
                    }

                    if (DEBUG_SIPNET === true) console.log('Peer: ' + peer + ' ' + subscription + ' ' + groups);
                    if (peer !== null) {
                        this.onXimssRosterItem(peerName, peer, groups, subscription);
                    }


                }

                if (tagName === "folderreport") {
                    var folder = xmlResponse.getAttribute('folder');
                    var mode = xmlResponse.getAttribute('mode');
                    var uid = xmlResponse.getAttribute('UID');


                    if (mode === "init") {
                        var messages = xmlResponse.getAttribute('messages');
                        var unseen = xmlResponse.getAttribute('unseen');
                        if (folder === 'INBOX') {
                            this.onXimssVoiceMessages(messages, unseen);
                        }
                        if (folder === 'MainContacts' || folder === 'MyContacts') {
                            this.onXimssContactsInfo(folder, messages);
                        }
                        this.doXimssFolderBrowse(folder, "0", messages);
                    } else if (mode === "removed") {
                        var index = xmlResponse.getAttribute('index');
                        this.onXimssContactRemoved(folder, uid);
                    } else if (mode === "added") {
                        var index = xmlResponse.getAttribute('index');
                        var messages = xmlResponse.getAttribute('messages');
                        var UID = xmlResponse.getAttribute('UID');
                        this.doXimssFolderBrowseByUID(folder, UID);

                    } else if (mode === "notify") {
                        this.doXimssFolderSync(folder);
                    } else if (mode === null && uid !== null) {
                        if (folder === 'INBOX') {
                            var flags = xmlResponse.firstChild.textContent;

                            this.onXimssVoiceMailFlags(uid, flags);
                        }

                        this.doXimssFolderRead(folder, uid);
                    }


                }
                if (tagName === "foldermessage") {
                    var folder = xmlResponse.getAttribute('folder');
                    var UID = xmlResponse.getAttribute('UID');
                    var xmlVCard = xmlResponse.firstChild;


                    if (folder === "INBOX") {


                        var EMail = xmlResponse.firstChild;

                        var From, Date, url;

                        for (var i = 0; i < EMail.childNodes.length; ++i) {
                            if (EMail.childNodes[i].tagName === 'MIME') {
                                var MIME = EMail.childNodes[i];
                                var MIME2 = MIME.firstChild;

                                var voiceFile = MIME2.getAttribute('Disposition-filename');
                                var partID = MIME2.getAttribute('partID');

                                url = 'https://' + this.serverName + '/Session/' + this.urlID + '/MIME/INBOX/' + UID + '-' + partID + '-B' + '/' + voiceFile;


                            }
                            if (EMail.childNodes[i].tagName === 'From') {
                                From = EMail.childNodes[i].textContent;
                            }
                            if (EMail.childNodes[i].tagName === 'Date') {
                                Date = EMail.childNodes[i].textContent;
                            }
                        }

                        this.onXimssVoiceFile(url, UID, From, Date);


                    } else {

                        var toFields = [];
                        var subject = '';
                        var xAgent = '';
                        var xWork = '';
                        var xLastName = '';
                        var xFirstName = '';
                        var MessageID = '';
                        var xDate = '';

                        var EMail2 = xmlResponse.firstChild;
                        for (var z = 0; z < EMail2.childNodes.length; z++) {
                            if (EMail2.childNodes[z].tagName === 'To') {
                                toFields.push(EMail2.childNodes[z].textContent);
                            }
                            if (EMail2.childNodes[z].tagName === 'Subject') {
                                subject = EMail2.childNodes[z].textContent;
                            }
                            if (EMail2.childNodes[z].tagName === 'X-Telnum') {
                                var xtAttr = EMail2.childNodes[z].getAttribute('type');
                                if (xtAttr === 'WORK') xWork = EMail2.childNodes[z].textContent;
                                if (xtAttr === 'AGENT') xAgent = EMail2.childNodes[z].textContent;
                            }

                            if (EMail2.childNodes[z].tagName === 'X-FirstName') {
                                xFirstName = EMail2.childNodes[z].textContent;
                            }
                            if (EMail2.childNodes[z].tagName === 'X-LastName') {
                                xLastName = EMail2.childNodes[z].textContent;
                            }
                            if (EMail2.childNodes[z].tagName === 'Message-ID') {
                                MessageID = EMail2.childNodes[z].textContent;
                            }
                            if (EMail2.childNodes[z].tagName === 'Date') {
                                xDate = EMail2.childNodes[z].textContent;
                            }
                        }


                        var peerContact = new Contact();

                        peerContact.vCardXML = xmlVCard;
                        peerContact.folder = folder;
                        peerContact.UID = UID;

                        peerContact.updateFromVCard(function () {
                            self.onXimssContact2(folder, peerContact, toFields, xAgent, xWork, xLastName, xFirstName, MessageID, xDate);
                        });

                        this.onXimssContact(folder, xmlVCard);
                    }
                }

                if (tagName === "mailboxsubscription") {
                    var mailbox = xmlResponse.getAttribute('mailbox');
                    this.onMailboxSubscription(mailbox);
                    this.doXimssMailboxRightsGet(mailbox);
                }

                if (tagName === "mailboxrights") {
                    var mailbox = xmlResponse.getAttribute('mailbox');
                    this.onXimssRights(mailbox);
                }


                if (tagName === "prefs") {
                    var type = xmlResponse.getAttribute('type');
                    if (type === "custom") {
                        var answer = xmlResponse.firstChild;
                        this.onXimssPrefsCustom(answer);
                    } else {
                        this.onXimssPrefs(xmlResponse);
                    }
                }

                if (tagName === "banner") {
                    this.onXimssBanner(xmlResponse);
                }
            }

        },

        ximssRecoverCallback: function (xmlResponse) {

            xmlResponse = this.str2xml(xmlResponse);
            if (DEBUG_SIPNET === true) console.log("%cS: " + (new XMLSerializer()).serializeToString(xmlResponse), "color:blue;");
            if (xmlResponse === null) return;
            var tagName = xmlResponse.childNodes[0].tagName.toLowerCase();

            if (tagName === "response") {
                var errorText = xmlResponse.childNodes[0].getAttribute("errorText");
                var errorNum = xmlResponse.childNodes[0].getAttribute("errorNum");

                if (errorText === null) {
                    this.onXimssRecoverPassword('Ok');
                } else {
                    this.onXimssRecoverPassword(errorText);
                }
            }


        },


        finalCallback: function (errorCode, xmlRequest) {
            if (DEBUG_SIPNET === true) console.log("%cC: " + (new XMLSerializer()).serializeToString(xmlRequest), "color:orange;");
            this.onXimssClosed();
        },

        str2xml: function (s) {
            var xml;
            if (window.DOMParser) {
                xml = new DOMParser().parseFromString(s, "application/xml");
            } else {
                xml = new ActiveXObject("Microsoft.XMLDOM");
                xml.async = false;
                xml.loadXML(s);
            }
            return xml.childNodes[0];
        },

        xml2str: function (xmlData) {
            return (window.XMLSerializer ? (new XMLSerializer()).serializeToString(xmlData) : xmlData.xml);
        },

        toString26: function(num) {

            function charRange(start, stop) {
                var result = [];

                // get all chars from starting char
                // to ending char
                var i = start.charCodeAt(0),
                    last = stop.charCodeAt(0) + 1;
                for (i; i < last; i++) {
                    result.push(String.fromCharCode(i));
                }

                return result;
            }

            var alpha = charRange('a', 'z');

            var result = '';

            // no letters for 0 or less
            if (num < 1) {
                return result;
            }

            var quotient = num,
                remainder;

            // until we have a 0 quotient
            while (quotient !== 0) {
                // compensate for 0 based array
                var decremented = quotient - 1;

                // divide by 26
                quotient = Math.floor(decremented / 26);

                // get remainder
                remainder = decremented % 26;

                // prepend the letter at index of remainder
                result = alpha[remainder+1] + result;
            }

            return result;
        },

        toInt26: function(str) {

            function charRange(start, stop) {
                var result = [];

                // get all chars from starting char
                // to ending char
                var i = start.charCodeAt(0),
                    last = stop.charCodeAt(0) + 1;
                for (i; i < last; i++) {
                    result.push(String.fromCharCode(i));
                }

                return result;
            }

            function intToIP(int) {
                var part1 = int & 255;
                var part2 = ((int >> 8) & 255);
                var part3 = ((int >> 16) & 255);
                var part4 = ((int >> 24) & 255);

                return part4 + "." + part3 + "." + part2 + "." + part1;
            }

            var alpha = charRange('a', 'z');
            var result = 0;

            // make sure we have a usable string
            str = str.toLowerCase();
            str = str.replace(/[^a-z]/g, '');

            // we're incrementing j and decrementing i
            var j = 0;
            for (var i = str.length - 1; i > -1; i--) {
                // get letters in reverse
                var char = str[i];


                // get index in alpha and compensate for
                // 0 based array
                var position = alpha.indexOf(char);

                //position++;

                // the power kinda like the 10's or 100's
                // etc... position of the letter
                // when j is 0 it's 1s
                // when j is 1 it's 10s
                // etc...
                var power = Math.pow(26, j);

                // add the power and index to result
                result += power * position;
                j++;
            }

            return result & 255;
        },

        randomString: function (length, chars) {
            var mask = '';
            if (chars.indexOf('a') > -1) mask += 'abcdefghijklmnopqrstuvwxyz';
            if (chars.indexOf('A') > -1) mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            if (chars.indexOf('#') > -1) mask += '0123456789';
            if (chars.indexOf('!') > -1) mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
            var result = '';
            for (var i = length; i > 0; --i) result += mask[Math.floor(Math.random() * mask.length)];
            return result;
        },

        checkDevices: function () {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                if (DEBUG_SIPNET === true) console.log("enumerateDevices() not supported.");
                return;
            }

            var self = this;
            navigator.mediaDevices.enumerateDevices().then(function (deviceInfos) {
                self.gotDevices(deviceInfos, self)
            }).catch(this.handleError);


        },

        handleError: function (error) {
            if (DEBUG_SIPNET === true) console.log('navigator.getUserMedia error: ', error);
        },

        gotDevices: function (deviceInfos, self) {
            if (DEBUG_SIPNET === true) console.log('gotDevices...');

            self.audioDevices = [];
            self.videoDevices = [];

            for (var i = 0; i !== deviceInfos.length; ++i) {
                var deviceInfo = deviceInfos[i];


                if (deviceInfo.kind === 'audioinput') {
                    if (DEBUG_SIPNET === true) console.log("A:" + deviceInfo.deviceId);
                    self.audioDevices.push(deviceInfo.deviceId);
                } else if (deviceInfo.kind === 'videoinput') {
                    if (DEBUG_SIPNET === true) console.log("V:" + deviceInfo.deviceId);
                    self.videoDevices.push(deviceInfo.deviceId);
                }
            }


        },

        versionCompare: function (v1, v2) {
            var zeroExtend = null;
            var lexicographical = true;

            var v1parts = v1.split('.');
            var v2parts = v2.split('.');

            function isValidPart(x) {
                return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
            }

            if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
                return NaN;
            }

            if (zeroExtend) {
                while (v1parts.length < v2parts.length) v1parts.push("0");
                while (v2parts.length < v1parts.length) v2parts.push("0");
            }

            if (!lexicographical) {
                v1parts = v1parts.map(Number);
                v2parts = v2parts.map(Number);
            }

            for (var i = 0; i < v1parts.length; ++i) {
                if (v2parts.length === i) {
                    return 1;
                }

                if (v1parts[i] === v2parts[i]) {
                    continue;
                }
                else if (v1parts[i] > v2parts[i]) {
                    return 1;
                }
                else {
                    return -1;
                }
            }

            if (v1parts.length !== v2parts.length) {
                return -1;
            }

            return 0;
        }

    };

    var SDPXML = function () {
    };

    SDPXML.getText = function (xmlSDP, eolString) {
        "use strict";

        function XMLAttrs2Text(xmlData, eolString) {
            var result = "";
            for (var xmlAttr = xmlData.firstChild; xmlAttr !== null; xmlAttr = xmlAttr.nextSibling) {
                if (xmlAttr.tagName === "attr") {
                    result += "a=" + xmlAttr.getAttribute("name") + (xmlAttr.hasChildNodes() ? ":" + xmlAttr.textContent : "") + eolString;
                }
            }
            return (result);
        }

        function mediaXML2Text(xmlMedia, defaultIP, eolString) {
            var theIP = SDPXML.parseXMLIPPair(xmlMedia.getAttribute("ip"));

            var codecs = "", codecList = "", id, x;
            for (var xmlCodec = xmlMedia.firstChild; xmlCodec !== null; xmlCodec = xmlCodec.nextSibling) {
                if (xmlCodec.tagName === "codec" && (id = xmlCodec.getAttribute("id")) !== null) {
                    codecs += "a=rtpmap:" + id + " " + xmlCodec.getAttribute("name") + eolString;
                    if ((x = xmlCodec.getAttribute("format")) !== null) codecs += "a=fmtp:" + id + " " + x + eolString;
                    codecList += " " + id;
                }
            }

            var result = "m=" + xmlMedia.getAttribute("media") + " " + theIP[1] + " " + xmlMedia.getAttribute("protocol") + codecList + eolString;
            if (theIP[0] !== defaultIP) result += "c=" + SDPXML.composeTextIP(theIP[0]) + eolString;

            if ((x = xmlMedia.getAttribute("direction")) !== null) result += "a=" + x + eolString;
            if ((x = xmlMedia.getAttribute("ptime")) !== null) result += "a=ptime:" + x + eolString;
            if ((x = xmlMedia.getAttribute("rtcp")) !== null) {
                x = SDPXML.parseXMLIPPair(x);
                result += "a=rtcp:" + x[1] + " " + SDPXML.composeTextIP(x[0]) + eolString;
            }

            result += codecs + XMLAttrs2Text(xmlMedia, eolString);
            return (result);
        }

        if (eolString === null) eolString = "\r\n";

        var defaultIP = xmlSDP.getAttribute("ip"), subject = xmlSDP.getAttribute("subject");

        var result = "v=0" + eolString;
        result += "o=" + xmlSDP.getAttribute("origUser") + " " + xmlSDP.getAttribute("sessionID") + " " +
            xmlSDP.getAttribute("sessionVersion") + " " + SDPXML.composeTextIP(xmlSDP.getAttribute("origIP")) + eolString;

        result += "s=" + (subject === null || subject === "" ? "-" : subject) + eolString;

        if (defaultIP !== null) result += "c=" + SDPXML.composeTextIP(defaultIP) + eolString;
        result += "t=0 0" + eolString;

        result += XMLAttrs2Text(xmlSDP, eolString);

        for (var xmlMedia = xmlSDP.firstChild; xmlMedia !== null; xmlMedia = xmlMedia.nextSibling) {
            if (xmlMedia.tagName === "media") result += mediaXML2Text(xmlMedia, defaultIP, eolString);
        }
        return (result);
    };


    SDPXML.parseText = function (textSDP, xmlDocument, eolString) {
        "use strict";

        if (eolString === null) eolString = "\r\n";

        function parseTextIP(text) {
            if (text === null || (text.substring(0, 7) !== "IN IP4 " && text.substring(0, 7) !== "IN IP6 ")) return ("null");
            return (text.charAt(7) === "[" ? text.substring(7) : "[" + text.substring(7) + "]");
        }

        function addAttributeToXML(value, xmlData, mediaCodecs) {
            var nameEnd = value.indexOf(':'), name, xmlCodec, parts;
            if (nameEnd >= 0) {
                name = value.substr(0, nameEnd);
                value = value.substr(nameEnd + 1);
            }
            else {
                name = value;
                value = null;
            }

            function getPrefix() {
                if (value === null || (nameEnd = value.indexOf(' ')) < 0) return (false);
                parts = [value.substring(0, nameEnd), value.substring(nameEnd + 1)];
                return (true);
            }


            if (mediaCodecs !== null) {
                if (name === "sendrecv" || name === "sendonly" || name === "recvonly" || name === "inactive") {
                    xmlData.setAttribute("direction", name);
                    return;
                }
                if (name === "ptime") {
                    xmlData.setAttribute("ptime", value);
                    return;
                }
                if (name === "rtcp") {
                    xmlData.setAttribute("rtcp", getPrefix() ?
                        parseTextIP(parts[1]) + ":" + parts[0] : "[0.0.0.0]:" + value);
                    return;
                }

                if ((name === "rtpmap" || name === "fmtp") && getPrefix() &&
                    (xmlCodec = mediaCodecs[parts[0]]) !== null) {
                    xmlCodec.setAttribute(name === "rtpmap" ? "name" : "format", parts[1]);
                    return;
                }
            }

            SDPXML.addAttribute(xmlData, name, value);
        }

        var xmlSDP = xmlDocument.createElement("sdp"), xmlMedia = null;

        var lines = textSDP.split(eolString), xLine, mediaPort, codecs;
        for (xLine = 0; xLine < lines.length; ++xLine) {
            var line = lines[xLine], value = line.substring(2), data, xmlCodec;

            if (line.charAt(1) === "=") switch (line.charAt(0)) {
                case 'c':
                    if (xmlMedia === null) xmlSDP.setAttribute("ip", parseTextIP(value));
                    else xmlMedia.setAttribute("ip", parseTextIP(value) + ":" + mediaPort);
                    break;
                case 's':
                    if (xmlMedia === null && value !== "" && value !== "-") xmlSDP.setAttribute("subject", value);
                    break;
                case 'o':
                    if (xmlMedia === null) {
                        data = value.split(" ");
                        xmlSDP.setAttribute("origUser", data.shift());
                        xmlSDP.setAttribute("sessionID", data.shift());
                        xmlSDP.setAttribute("sessionVersion", data.shift());
                        xmlSDP.setAttribute("origIP", parseTextIP(data.join(" ")));
                    }
                    break;
                case 'a':
                    addAttributeToXML(value, (xmlMedia !== null ? xmlMedia : xmlSDP), codecs);
                    break;
                case 'm':
                    xmlSDP.appendChild(xmlMedia = xmlDocument.createElement("media"));
                    data = value.split(" ");
                    xmlMedia.setAttribute("media", data[0]);
                    mediaPort = data[1];
                    xmlMedia.setAttribute("protocol", data[2]);
                    codecs = {};
                    for (var i = 3; i < data.length; ++i) {
                        xmlMedia.appendChild(xmlCodec = xmlDocument.createElement("codec"));
                        xmlCodec.setAttribute("id", data[i]);
                        codecs[data[i]] = xmlCodec;
                    }
            }
        }

        return (xmlSDP);
    };


    SDPXML.adjustServerXML = function (xmlSDP) {
        "use strict";

        function adjustMedia(xmlMedia) {

            if (xmlMedia.getAttribute("protocol").toLowerCase().substring(0, 4) === "rtp/" &&
                SDPXML.findAttribute(xmlMedia, "setup") !== null || SDPXML.findAttribute(xmlSDP, "setup") !== null) xmlMedia.setAttribute("protocol", "RTP/SAVPF");


            if (SDPXML.findAttribute(xmlMedia, "candidate") === null && (SDPXML.findAttribute(xmlMedia, "ice-ufrag") !== null || SDPXML.findAttribute(xmlSDP, "ice-ufrag") !== null)) {
                var ipPair = SDPXML.parseXMLIPPair(xmlMedia.getAttribute("ip"));
                if (ipPair[0].charAt(0) === "[") ipPair[0] = ipPair[0].substring(1, ipPair[0].indexOf("]"));
                SDPXML.addAttribute(xmlMedia, "candidate", "7777777 1 UDP 77 " + ipPair[0] + " " + ipPair[1] + " typ host");
            }

            SDPXML.removeAttributes(xmlMedia, "crypto");
        }

        if(xmlSDP){
            for (var xmlMedia = xmlSDP.firstChild; xmlMedia !== null; xmlMedia = xmlMedia.nextSibling) {
                if (xmlMedia.tagName === "media") adjustMedia(xmlMedia);
            }
            SDPXML.removeAttributes(xmlSDP, "crypto");
        }

        return (xmlSDP);
    };


    SDPXML.adjustWebRTCXML = function (xmlSDP, webRTCVersion, newOrigUser) {
        "use strict";

        function adjustMedia(xmlMedia) {

            if (xmlMedia.getAttribute("protocol").toLowerCase().substring(0, 4) === "udp/" &&
                SDPXML.findAttribute(xmlMedia, "setup") !== null || SDPXML.findAttribute(xmlSDP, "setup") !== null) xmlMedia.setAttribute("protocol", "RTP/SAVPF");

            //var ipPair = SDPXML.parseXMLIPPair(xmlMedia.getAttribute("ip"));
            //if (ipPair[1] !== "0") xmlMedia.setAttribute("ip", "[10.255.255.255]:" + ipPair[1]);
        }

        var detectorInfo = null;
        var detectorInfoStr = '';
        try {
            detectorInfo = detector;
            detectorInfoStr = detectorInfo["os"] + ' ' + detectorInfo["os_version"] + ' ' + detectorInfo["os_platform"] + ' ' + detectorInfo["client"] + ' ' + detectorInfo["client_name"] + ' ' + detectorInfo["client_version"] + ' ' + detectorInfo["device_brand"] + ' ' + detectorInfo["device_model"] + ' ' + detectorInfo["display"];
            detectorInfoStr = detectorInfoStr.replace(/\s+/g, " ");
        } catch (e) {
            if (DEBUG_SIPNET === true) console.log("No detector found!");
        }

        if (detectorInfo !== null) {
            SDPXML.addAttribute(xmlSDP, "webrtc", webRTCVersion === null ? detectorInfoStr : webRTCVersion);
        } else {
            SDPXML.addAttribute(xmlSDP, "webrtc", webRTCVersion === null ? "yes" : webRTCVersion);
        }

        if (newOrigUser !== null && newOrigUser.indexOf(" ") < 0) xmlSDP.setAttribute("origUser", newOrigUser);

        for (var xmlMedia = xmlSDP.firstChild; xmlMedia !== null; xmlMedia = xmlMedia.nextSibling) {
            if (xmlMedia.tagName === "media") adjustMedia(xmlMedia);
        }


        return (xmlSDP);
    };


    SDPXML.setActiveMediaDirection = function (xmlSDP, newDirection) {
        "use strict";
        for (var xmlMedia = xmlSDP.firstChild; xmlMedia !== null; xmlMedia = xmlMedia.nextSibling) {
            if (xmlMedia.tagName === "media" && xmlMedia.getAttribute("direction") !== "inactive" &&
                SDPXML.parseXMLIPPair(xmlMedia.getAttribute("ip"))[1] !== "0") xmlMedia.setAttribute("direction", newDirection);
        }
    };


    SDPXML.removeNonAudioMedia = function (xmlSDP) {
        "use strict";
        var result = [], nextMedia;
        for (var xmlMedia = xmlSDP.firstChild; xmlMedia !== null; xmlMedia = nextMedia) {
            nextMedia = xmlMedia.nextSibling;
            if (xmlMedia.tagName === "media") {
                if (xmlMedia.getAttribute("media") === "audio") result.push("*");
                else {
                    result.push(xmlMedia.getAttribute("media"));
                    xmlSDP.removeChild(xmlMedia);
                }
            }
        }
        return (result.length === 0 || (result.length === 1 && result[0] === "*") ? null : result);
    };


    SDPXML.addDummyMedia = function (xmlSDP, otherMedia) {
        "use strict";
        if (otherMedia === null) return;
        var nextMedia = xmlSDP.firstChild;
        while (nextMedia !== null && nextMedia.tagName !== "media") nextMedia = nextMedia.nextSibling;

        for (var index = 0; index < otherMedia.length; ++index) {
            if (otherMedia[index] !== "*") {
                var dummyMedia = xmlSDP.ownerDocument.createElement("media");
                dummyMedia.setAttribute("media", otherMedia[index]);
                dummyMedia.setAttribute("ip", "[0.0.0.0]:0");
                dummyMedia.setAttribute("direction", "inactive");
                if (otherMedia[index] === "video") {
                    var dummyCodec = xmlSDP.ownerDocument.createElement("codec");
                    dummyCodec.setAttribute("id", "177");
                    dummyCodec.setAttribute("name", "dummy/8000");
                    dummyMedia.appendChild(dummyCodec);
                }
                xmlSDP.insertBefore(dummyMedia, nextMedia);
            } else if (nextMedia !== null) {
                nextMedia = nextMedia.nextSibling;
            }
        }
    };


    SDPXML.isOnHold = function (xmlSDP) {
        "use strict";

        if (SDPXML.findAttribute(xmlSDP, "x-moh") !== null) return (true);

        for (var xmlMedia = xmlSDP.firstChild; xmlMedia !== null; xmlMedia = xmlMedia.nextSibling) {
            if (xmlMedia.tagName === "media" && xmlMedia.getAttribute("media") === "audio") {
                return (SDPXML.findAttribute(xmlSDP, "x-moh") !== null || xmlMedia.getAttribute("direction") === "inactive" || xmlMedia.getAttribute("direction") === "sendonly");
            }
        }
        return (false);
    };


    SDPXML.composeTextIP = function (theIP) {
        "use strict";
        if (theIP === null) theIP = "[0.0.0.0]";
        if (theIP.charAt(0) === "[") theIP = theIP.substring(1, theIP.indexOf("]"));
        return ("IN " + (theIP.indexOf(":") >= 0 ? "IP6 " : "IP4 ") + theIP);
    };


    SDPXML.parseXMLIPPair = function (theIP) {
        "use strict";
        if (theIP === null) return (["[0.0.0.0]", "0"]);
        var x = theIP.lastIndexOf(":");
        return (x >= 0 ? [theIP.substring(0, x), theIP.substring(x + 1)] : [theIP, "0"]);
    };

    SDPXML.findAttribute = function (xmlData, name) {
        "use strict";
        for (var xmlAttr = xmlData.firstChild; xmlAttr !== null; xmlAttr = xmlAttr.nextSibling) {
            if (xmlAttr.tagName === "attr" && xmlAttr.getAttribute("name") === name) return (xmlAttr);
        }
        return (null);
    };

    SDPXML.addAttribute = function (xmlData, name, value) {
        "use strict";
        var xmlAttr = xmlData.ownerDocument.createElement("attr");
        xmlData.appendChild(xmlAttr);
        xmlAttr.setAttribute("name", name);
        if (value !== null) xmlAttr.textContent = value;
    };

    SDPXML.removeAttributes = function (xmlData, name) {
        "use strict";
        for (var xmlAttr = xmlData.firstChild; xmlAttr !== null;) {
            var nextAttr = xmlAttr.nextSibling;
            if (xmlAttr.tagName === "attr" && xmlAttr.getAttribute("name") === name) xmlData.removeChild(xmlAttr);
            xmlAttr = nextAttr;
        }
        return (null);
    };

    return ximss;
}

var ximssSession = new XimssSession();
if (DEBUG_SIPNET === true) console.log(ximssSession);
