export default function ChatMessage(props: { messageType: 'user' | 'bot', messageContent: string }) {
  return <>
    <p>
      {props.messageType + ": " + props.messageContent}
    </p>
  </>
}