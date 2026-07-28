import { Link, type LinkProps } from 'react-router-dom'

/**
 * 문장 안에서 다른 화면으로 보내는 링크.
 *
 * 처음에 이걸 <a> 로 만들어 놓고 "추출했다"고 커밋했는데, 실제 사용처는 전부
 * react-router <Link> 여서 타입이 안 맞아 한 곳도 쓰이지 않았다. 중복은 5곳에
 * 그대로 남아 있었다. Link 를 감싸도록 고쳐서 실제로 쓴다.
 */
export function TextLink({ className = '', ...rest }: LinkProps) {
  return <Link className={`font-medium text-ink underline ${className}`} {...rest} />
}
