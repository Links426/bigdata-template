import { NonIndexRouteObject, RouteMatch, useLocation, useNavigate, useRoutes } from "react-router-dom"
import {
    Fragment,
    JSXElementConstructor,
    memo,
    ReactElement,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { MenuFoldOutlined, MenuUnfoldOutlined, PoweroffOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons"
import { isNil, reduce, last, filter, not, isEmpty } from "ramda"
import { PageConfig, usePageContext } from "@/providers/PageManageProvider"
import { SuspenseLoading } from "@/components/SuspenseLoading"
import { Avatar, Breadcrumb, Button, Drawer, Input, Layout as ALayout, Menu, Space, Tabs } from "antd"
import type { ItemType } from "antd/lib/menu/hooks/useItems"
import KeepAlive from "keepalive-for-react"
import { RouteConfig } from "@/router/config"
import { hasAllAuth, hasAnyAuth } from "@/utils/auth"
import { primaryColor } from "@/config"
import { ErrorBoundary } from "@ant-design/pro-components"
import mergePath from "@/utils/mergePath"
import SearchBox from "@/layout/components/SearchBox"

// to prevent re-rendering when user input a new url to navigate
const MemoizedKeepAlive = memo(KeepAlive, (prev, next) => {
    return prev.activeName === next.activeName
})

function checkAuthPass(route: RouteConfig) {
    if (isNil(route.authority) || isEmpty(route.authority)) {
        return true
    }
    const type = isNil(route.authorityType) ? "all" : route.authorityType
    const authority = route.authority
    if (type === "all") {
        return hasAllAuth(authority)
    } else {
        return hasAnyAuth(authority)
    }
}

// 渲染导航栏
function renderMenuItems(data: Array<RouteConfig>, open: (info: PageConfig) => void, path?: string) {
    function renderMenu(data: Array<RouteConfig>, path?: string) {
        return reduce(
            (items, route) => {
                // 不在菜单显示
                if (route.notMenu) {
                    return items
                }
                // 权限验证 不通过不显示
                if (!checkAuthPass(route)) {
                    return items
                }
                const thisPath = mergePath(route.path, path)
                const children = filter(route => not(route.notMenu), route.children ?? [])
                const hasChildren = isNil(children) || isEmpty(children)
                items.push({
                    key: route.name,
                    title: route.meta?.title,
                    icon: route.icon,
                    label: !hasChildren ? (
                        <span className="a-black">{route.meta?.title}</span>
                    ) : (
                        <a
                            onClick={() => {
                                open({
                                    key: thisPath,
                                    label: route.meta?.title as string,
                                })
                            }}
                            className="a-black"
                        >
                            {route.meta?.title}
                        </a>
                    ),
                    children: hasChildren ? undefined : renderMenu(children, thisPath),
                })
                return items
            },
            [] as ItemType[],
            data,
        )
    }

    return renderMenu(data, path)
}

function getRouteContext(data: any): any {
    if (isNil(data.children)) {
        return null
    }
    return isNil(data.routeContext) ? getRouteContext(data.children.props) : data.routeContext
}

function getLatchRouteByEle(ele: ReactElement): RouteMatch[] | null {
    if (ele) {
        const data = getRouteContext(ele.props)
        return isNil(data?.outlet) ? (data?.matches as RouteMatch[]) : getLatchRouteByEle(data?.outlet)
    }
    return null
}

function getMatchRouteObj(ele: ReactElement | null) {
    if (isNil(ele)) {
        return null
    }
    const matchRoutes = getLatchRouteByEle(ele)
    if (isNil(matchRoutes)) {
        return null
    }
    const selectedKeys: string[] = reduce(
        (selectedKeys: string[], res) => {
            const route = res.route as RouteObjectDto
            if (route.name) {
                selectedKeys.push(route.name)
            }
            return selectedKeys
        },
        [],
        matchRoutes,
    )
    const crumbs = reduce(
        (
            crumbs: {
                name: string
                title: string
            }[],
            res,
        ) => {
            const route = res.route as RouteObjectDto
            if (route.name && route.meta?.title) {
                crumbs.push({
                    name: route.name,
                    title: route.meta?.title,
                })
            }
            return crumbs
        },
        [],
        matchRoutes,
    )
    const matchRoute = last(matchRoutes)
    const data = matchRoute?.route as RouteObjectDto
    return {
        key: data.layout ? matchRoute?.pathnameBase ?? "" : matchRoute?.pathname ?? "",
        title: data?.meta?.title ?? "",
        name: data?.name ?? "",
        selectedKeys,
        crumbs,
        cache: data.cache,
    }
}

export interface RouteObjectDto extends NonIndexRouteObject {
    name: string
    meta?: { title: string }
    cache: boolean
    layout?: boolean // 嵌套二次自定义布局
}

function makeRouteObject(routes: RouteConfig[], upperPath?: string): Array<RouteObjectDto> {
    const RouteObjectDtoList: Array<RouteObjectDto> = []
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i]
        const fullPath = mergePath(route.path, upperPath)
        const cache = isNil(route.cache) ? false : route.cache
        // 检查权限 不通过不渲染
        if (!checkAuthPass(route)) {
            continue
        }
        const routeObjectDto: RouteObjectDto = {
            path: route.path,
            name: route.name,
            meta: route.meta,
            cache,
            element: <route.component meta={route.meta} />,
            children: isNil(route.children) ? undefined : makeRouteObject(route.children, fullPath),
        }
        RouteObjectDtoList.push(routeObjectDto)
    }
    return RouteObjectDtoList
}

interface Props {
    route: RouteConfig
}

function Layout({ route }: Props) {
    console.log("Layout render")
    const [showSearch, setShowSearch] = useState(false)
    const eleRef = useRef<ReactElement<any, string | JSXElementConstructor<any>> | null>()
    const location = useLocation()
    const { pages, active, open, close, getKeepAliveRef } = usePageContext()
    const keepAliveRef = getKeepAliveRef()
    const navigate = useNavigate()
    const routes = useMemo(() => {
        if (isNil(route.children)) {
            return [] as RouteObjectDto[]
        }
        return makeRouteObject(route.children)
    }, [route])

    const items = useMemo(() => {
        if (isNil(route.children)) {
            return [] as ItemType[]
        }
        return renderMenuItems(route.children, open)
    }, [route, routes, open])

    // 匹配 当前路径要渲染的路由
    const ele = useRoutes(routes, location)

    const matchRouteObj = useMemo(() => {
        eleRef.current = ele
        return getMatchRouteObj(ele)
    }, [routes, location])

    const routerPathKey = useMemo(() => {
        return location.pathname + location.search
    }, [location.pathname, location.search])

    // listen url change to open page
    useEffect(() => {
        if (matchRouteObj) {
            open({
                key: routerPathKey,
                label: matchRouteObj.title,
            } as PageConfig)
        }
    }, [routerPathKey])

    const [collapsed, setCollapsed] = useState(false)
    const [showSide, setShowSide] = useState(true)

    useLayoutEffect(() => {
        function onResize() {
            const width = window.innerWidth
            if (width < 768) {
                setCollapsed(true)
            }
            if (width > 1400) {
                setCollapsed(false)
            }
            if (width < 660) {
                setShowSide(false)
            } else {
                setShowSide(true)
            }
        }
        onResize()
        window.addEventListener("resize", onResize)
        return () => {
            window.removeEventListener("resize", onResize)
        }
    }, [setCollapsed, setShowSide])

    return (
        <Fragment>
            <SearchBox
                open={showSearch}
                onClose={() => {
                    setShowSearch(false)
                }}
                route={route}
            ></SearchBox>
            {!showSide && (
                <Drawer
                    placement={"left"}
                    width={240}
                    styles={{
                        body: {
                            padding: 0,
                        },
                    }}
                    onClose={() => {
                        setCollapsed(true)
                    }}
                    open={!collapsed}
                >
                    <Menu
                        style={{
                            padding: "10px 10px",
                        }}
                        selectedKeys={matchRouteObj?.selectedKeys}
                        defaultOpenKeys={matchRouteObj?.selectedKeys}
                        items={items}
                        mode={"inline"}
                    />
                </Drawer>
            )}
            <ALayout className={"w-full h-screen"}>
                <ALayout>
                    {showSide && (
                        <ALayout.Sider
                            style={{
                                overflow: "auto",
                            }}
                            collapsed={collapsed}
                            width={240}
                            theme="light"
                        >
                            <Menu
                                style={{
                                    padding: "10px 10px",
                                }}
                                selectedKeys={matchRouteObj?.selectedKeys}
                                defaultOpenKeys={matchRouteObj?.selectedKeys}
                                items={items}
                                mode={"inline"}
                            />
                        </ALayout.Sider>
                    )}
                    <ALayout className={"bg-{#F0F2F5} dark:bg-[#191919]"}>
                        <div
                            style={{
                                height: 50,
                                display: "flex",
                                padding: "0 10px",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                            className="app-header flex-shrink-0 bg-white dark:bg-[#111]"
                        >
                            <div className={"header-left flex items-center"}>
                                <Button
                                    onClick={() => {
                                        setCollapsed(!collapsed)
                                    }}
                                    type={"link"}
                                    icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                                ></Button>
                                {showSide && (
                                    <div className={"crumbs flex-shrink-0 pb-[2px] ml-[10px]"}>
                                        <Breadcrumb items={matchRouteObj?.crumbs}></Breadcrumb>
                                    </div>
                                )}
                            </div>
                            <div>
                                <Space>
                                    {/*search*/}

                                    <Button
                                        size={"small"}
                                        type={"link"}
                                        icon={<SearchOutlined />}
                                        onClick={() => {
                                            setShowSearch(true)
                                        }}
                                    ></Button>

                                    <Avatar
                                        size={"small"}
                                        style={{
                                            backgroundColor: primaryColor,
                                        }}
                                        icon={<UserOutlined />}
                                    />
                                    <Button
                                        shape={"circle"}
                                        danger
                                        type={"primary"}
                                        size={"small"}
                                        icon={<PoweroffOutlined />}
                                        onClick={() => {
                                            navigate("/login")
                                        }}
                                    ></Button>
                                </Space>
                            </div>
                        </div>
                        <Tabs
                            className="app-tabs"
                            style={{
                                margin: "0 5px",
                                marginTop: 5,
                            }}
                            destroyInactiveTabPane
                            size={"small"}
                            hideAdd
                            type="editable-card"
                            onChange={key => {
                                const page = pages.find(item => item.key === key)
                                if (page) {
                                    open(page)
                                }
                            }}
                            onEdit={(targetKey, action) => {
                                if (action === "remove") {
                                    close(targetKey as string)
                                }
                            }}
                            activeKey={active}
                            items={pages}
                        />
                        <ALayout.Content
                            className="app-content px-[5px]"
                            style={{
                                overflow: "auto",
                                paddingBottom: 5,
                            }}
                        >
                            <SuspenseLoading>
                                <MemoizedKeepAlive
                                    errorElement={ErrorBoundary as any}
                                    aliveRef={keepAliveRef}
                                    cache={matchRouteObj?.cache}
                                    activeName={active}
                                    maxLen={20}
                                >
                                    {eleRef.current}
                                </MemoizedKeepAlive>
                            </SuspenseLoading>
                        </ALayout.Content>
                    </ALayout>
                </ALayout>
            </ALayout>
        </Fragment>
    )
}

export default Layout
