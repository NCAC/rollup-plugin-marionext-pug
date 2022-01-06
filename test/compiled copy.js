export default function templateTest(data, view) {
  if (!VDom) {
    throw "VDom not found.";
  }
  const n0Child = [];
  var n1Child = [];
  if (data.index > 1) {
    var n2Child = [];
    n2Child.push(VDom.text("index inférieur à 1"))
    var props2 = {attrs: VDom.compileAttributes([{name:'class', val: 'paragraph'},{name:'data-index', val: data.index}], [])};
    // UIEvent
    /**
     * 1. get an array of selectors that correspond to the current tag [".classA", ".classB", "#id"] for example
     * 2. check if this selector exists in view.ViewUIEvents.getBindinds()
     * 3. if it exixts, create an object events2 with this shape : { name_of_event: eventHandlerFunction, another_event_name: anotherEventHandlerFunction }
     * 4. prop2.on = events2
     */
    if (props2.attrs.id) props2.key = props2.attrs.id;
    var n2 = VDom.h('p', props2, n2Child)
    n1Child.push(n2);
  } else {
    var n3Child = [];
    n3Child.push(VDom.text("index supérieur à 1"))
    var props3 = {attrs: VDom.compileAttributes([{name:'class', val: 'paragraph'},{name:'data-index', val: data.index}], [])};
    if (props3.attrs.id) props3.key = props3.attrs.id;
    var n3 = VDom.h('p', props3, n3Child)
    n1Child.push(n3);
  }
  var n4Child = [];
  var props4 = {attrs: VDom.compileAttributes([{name:'class', val: 'list'}], [])};
  if (props4.attrs.id) props4.key = props4.attrs.id;
  var n4 = VDom.h('ul', props4, n4Child)
  n1Child.push(n4);
  var v5 = data.items
  Object.keys(v5).forEach(function (index) {
    var item = v5[index]
    var n6Child = [];
    var n7Child = [];
    n7Child.push(VDom.text("item"))
    var props7 = {attrs: VDom.compileAttributes([{name:'class', val: 'item-text'}], [])};
    if (props7.attrs.id) props7.key = props7.attrs.id;
    var n7 = VDom.h('span', props7, n7Child)
    n6Child.push(n7);
    n6Child.push(image(index));
    var props7 = {attrs: VDom.compileAttributes([{name:'class', val: 'item'}], [])};
    if (props7.attrs.id) props7.key = props7.attrs.id;
    var n7 = VDom.h('li', props7, n7Child)
    n1Child.push(n7);
  }.bind(view))
  var props7 = {attrs: VDom.compileAttributes([{name:'id', val: 'test'}], [])};
  if (props7.attrs.id) props7.key = props7.attrs.id;
  var n7 = VDom.h('div', props7, n7Child)
  n0Child.push(n7);
  function image(index, __block) {
    var n8Child = []
    var n9Child = [];
    var props9 = {attrs: VDom.compileAttributes([{name:'class', val: 'item-picture'},{name:'src', val: `https://www.example.com/assets/image${index}.png`}], [])};
    if (props9.attrs.id) props9.key = props9.attrs.id;
    var n9 = VDom.h('img', props9, n9Child)
    n8Child.push(n9);
    return n9Child
  }
  return n0Child;
}
