import {  Card, Input, Space,Button } from "antd"
import { useOnActive } from "keepalive-for-react"
import { useEffect, useState } from "react"
import { usePageContext } from "@/providers/PageManageProvider"
import useKeepAliveKey from "@/hooks/useKeepAliveKey.ts"
import { useThemeContext } from "@/providers/ThemeProvider"
import { useAppDispatch, useAppSelector } from "@/hooks"
import { decrement, increment } from "@/features/counter/counterSlice"


function Home() {
    const [active, setActive] = useState(false)
    const count = useAppSelector(state => state.counter.value)
    const dispatch = useAppDispatch()
    const { toggleTheme } = useThemeContext()
    const homeKey = useKeepAliveKey()
    const domRef = useOnActive(() => {
        console.log("Home onActive")
        setActive(true)
        return () => {
            console.log("Home onInactive")
        }
    }, false)

    useEffect(() => {
        console.log("HomeKey ------->", homeKey)
    }, [])

    const { closeCurrent, open } = usePageContext()
    return (
        <Card title={"首页 (带缓存)"} ref={domRef}>
            <div className={"w-full h-full flex-col flex justify-center"}>
                <div className={"flex w-[400px] mb-[30px] items-center"}>

                    <Button type={"link"}>Redux Example</Button>
                    <Button
                        onClick={() => {
                            dispatch(decrement())
                        }}
                    >
                        minus -
                    </Button>
                    <Input value={count}></Input>
                    <Button
                        onClick={() => {
                            dispatch(increment())
                        }}
                    >
                        plus +
                    </Button>
                </div>
                <Space className={"mb-[20px]"}>
                    <Button
                        onClick={() => {
                            toggleTheme()
                        }}
                    >
                        切换主题
                    </Button>
                    <Button
                        danger
                        type={"primary"}
                        onClick={() => {
                            closeCurrent()
                        }}
                    >
                        关闭
                    </Button>
                    <Button
                        onClick={() =>
                            open({
                                key: "/no-cache",
                                label: "无缓存页面",
                            })
                        }
                    >
                        打开无缓存页面
                    </Button>
                    <Button
                        type={"primary"}
                        ghost
                        onClick={() =>
                            open({
                                key: "/" + "?id=1",
                                label: "有参数页面",
                            })
                        }
                    >
                        打开有参数首页
                    </Button>
                </Space>
                <Input
                    style={{
                        marginBottom: "20px",
                    }}
                    placeholder="输入一个值 然后切换tab组件不会被销毁"
                ></Input>
                <Button type="primary">Primary Button</Button>
            </div>
        </Card>
    )
}

export default Home
