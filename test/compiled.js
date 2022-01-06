export default function templateTest(data, uiEventsBindings) {
  if (!VDom) {
    throw "VDom not found.";
  }
  const n0Child = [];
  var n1Child = [];
  if (data.index > 1) {
    var n2Child = [];
    n2Child.push(VDom.text("index inférieur à 1"))
    var props2 = {attrs: VDom.compileAttributes([{name:'class', val: 'paragraph'},{name:'data-index', val: data.index}], [])};
    if (props2.attrs.id) {
      props2.key = props2.attrs.id;
    }
    var n2 = VDom.h('p', props2, n2Child)
    n1Child.push(n2);
  } else {
    var n3Child = [];
    n3Child.push(VDom.text("index supérieur à 1"))
    var props3 = {attrs: VDom.compileAttributes([{name:'class', val: 'paragraph'},{name:'data-index', val: data.index}], [])};
    if (props3.attrs.id) {
      props3.key = props3.attrs.id;
    }
    var n3 = VDom.h('p', props3, n3Child)
    n1Child.push(n3);
  }
  var n4Child = [];
  var props4 = {attrs: VDom.compileAttributes([{name:'class', val: 'list'}], [])};
  if (props4.attrs.id) {
    props4.key = props4.attrs.id;
  }
  var n4 = VDom.h('ul', props4, n4Child)
  n1Child.push(n4);
  var v5 = data.items
  Object.keys(v5).forEach(function (index) {
    var item = v5[index]
    var n6Child = [];
    var n7Child = [];
    n7Child = n7Child.concat(VDom.text(item))
    var props7 = {attrs: VDom.compileAttributes([{name:'class', val: 'item-text'}], [])};
    if (props7.attrs.id) {
      props7.key = props7.attrs.id;
    }
    var n7 = VDom.h('span', props7, n7Child)
    n6Child.push(n7);
    var n8Child = [];
    var props8 = {attrs: VDom.compileAttributes([], [])};
    if (props8.attrs.id) {
      props8.key = props8.attrs.id;
    }
    var n8 = VDom.h('br', props8, n8Child)
    n6Child.push(n8);
    n6Child.push(image(index));
    var props6 = {attrs: VDom.compileAttributes([{name:'class', val: 'item'},{name:'class', val: 'anotherclass'}], [])};
    if (props6.attrs.id) {
      props6.key = props6.attrs.id;
    }
    var n6 = VDom.h('li', props6, n6Child)
    n1Child.push(n6);
  }.bind(this))
  var props1 = {attrs: VDom.compileAttributes([{name:'id', val: 'test'}], [])};
  if (props1.attrs.id) {
    props1.key = props1.attrs.id;
  }
  var n1 = VDom.h('div', props1, n1Child)
  n0Child.push(n1);
  function image(index, __block) {
    var n9Child = []
    var n10Child = [];
    var props10 = {attrs: VDom.compileAttributes([{name:'class', val: 'item-picture'},{name:'src', val: `https://www.example.com/assets/image${index}.png`}], [])};
    if (props10.attrs.id) {
      props10.key = props10.attrs.id;
    }
    var n10 = VDom.h('img', props10, n10Child)
    n9Child.push(n10);
    return n9Child
  }
  return n0Child;
}
