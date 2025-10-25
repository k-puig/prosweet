export default function ChatButton(props: { type: 'disabled' | 'send' | 'stop', onSend: () => void, onStop: () => void }) {
  const onPress = () => {
    if (props.type === 'send') {
      props.onSend();
    } else if (props.type === 'stop') {
      props.onStop();
    }
  }

  return <>
    <button className=" m-8 px-5 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800" onClick={onPress}>
      {props.type}
    </button>
  </>
}