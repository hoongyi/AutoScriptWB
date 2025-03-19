/*
 * @Author: TonyJiangWJ
 * @Last Modified by: TonyJiangWJ
 * @Last Modified time: 2022-12-07 21:29:16
 * @Description: 
 */
require('@/modules/init_if_needed.js')(runtime, global) // 引入并执行初始化模块
let { config } = require('@/simpleConfig.js') // 引入配置模块并解构出config对象
const resolver = require('@/lib/AutoJSRemoveDexResolver.js') // 引入dex移除解析器
let runningQueueDispatcher = require('@/lib/prototype/RunningQueueDispatcher') // 引入运行队列调度器
let { logInfo, errorInfo, warnInfo, debugInfo, infoLog, debugForDev, flushAllLogs } = require('@/lib/prototype/LogUtils') // 引入日志工具并解构出各种日志方法
let FloatyInstance = require('@/lib/prototype/FloatyUtil') // 引入悬浮窗工具
let commonFunctions = require('@/lib/prototype/CommonFunction') // 引入通用函数
commonFunctions.delayIfBatteryLow() // 如果电池电量低则延迟执行
let callStateListener = !config.is_pro && config.enable_call_state_control ? require('@/lib/prototype/CallStateListener') : { exitIfNotIdle: () => { } } // 根据配置条件引入或定义空的通话状态监听器
let resourceMonitor = require('@/lib/ResourceMonitor.js')(runtime, global) // 引入资源监控器并执行
let unlocker = require('@/lib/Unlock.js') // 引入解锁工具
let automator = require('@/lib/prototype/Automator') // 引入自动化工具
let mainExecutor = require('@/core/MainExecutor.js') // 引入主执行器
callStateListener.exitIfNotIdle() // 如果不空闲则退出
if (config.single_script) { // 如果配置为单脚本模式
  logInfo('======单脚本运行直接清空任务队列=======') // 记录日志信息
  runningQueueDispatcher.clearAll() // 清空任务队列
}
logInfo('======加入任务队列，并关闭重复运行的脚本=======') // 记录日志信息
runningQueueDispatcher.addRunningTask() // 添加运行任务到队列
commonFunctions.killDuplicateScript() // 终止重复运行的脚本
commonFunctions.registerOnEngineRemoved(function () { // 注册引擎移除时的回调函数
  config.resetBrightness && config.resetBrightness() // 如果配置重置亮度则执行
  events.removeAllListeners() // 移除所有事件监听器
  events.recycle() // 回收事件资源
  debugInfo('校验并移除已加载的dex') // 记录调试信息
  resolver() // 执行dex移除解析器
  flushAllLogs() // 刷新所有日志
  commonFunctions.reduceConsoleLogs() // 减少控制台日志
  runningQueueDispatcher.removeRunningTask(true, true, // 移除运行任务
    () => {
      unlocker.saveNeedRelock() // 保存是否需要重新锁屏
      config.isRunning = false // 设置运行状态为false
    }
  )
}, 'main') // 指定回调函数的上下文为'main'
logInfo('======校验无障碍功能======') // 记录日志信息
if (!commonFunctions.ensureAccessibilityEnabled()) { // 检查无障碍服务是否启用
  errorInfo('获取无障碍权限失败') // 记录错误信息
  exit() // 退出脚本
}
commonFunctions.markExtendSuccess() // 标记扩展成功
logInfo('---前置校验完成;启动系统--->>>>') // 记录日志信息
if (files.exists('version.json')) { // 如果存在version.json文件
  let content = JSON.parse(files.read('version.json')) // 读取并解析文件内容
  logInfo(['版本信息：{} nodeId:{}', content.version, content.nodeId]) // 记录版本信息日志
} else if (files.exists('project.json')) { // 如果存在project.json文件
  let content = JSON.parse(files.read('project.json')) // 读取并解析文件内容
  logInfo(['版本信息：{}', content.versionName]) // 记录版本信息日志
} else {
  logInfo('无法获取脚本版本信息') // 记录无法获取版本信息的日志
}
logInfo(['AutoJS version: {}', app.autojs.versionName]) // 记录AutoJS版本信息日志
logInfo(['device info: {} {} {}', device.brand, device.product, device.release]) // 记录设备信息日志
logInfo(['设备分辨率：[{}, {}]', config.device_width, config.device_height]) // 记录设备分辨率日志
logInfo('======解锁并校验截图权限======') // 记录日志信息
try {
  unlocker.exec() // 执行解锁操作
} catch (e) {
  if (!config.forceStop) {
    errorInfo('解锁发生异常, 三分钟后重新开始' + e) // 记录解锁异常的错误信息
    commonFunctions.printExceptionStack(e) // 打印异常堆栈信息
    commonFunctions.setUpAutoStart(3) // 设置三分钟后自动启动
    runningQueueDispatcher.removeRunningTask() // 移除运行任务
    exit() // 退出脚本
  }
}
logInfo('解锁成功') // 记录解锁成功的日志信息
let executeArguments = engines.myEngine().execArgv // 获取当前引擎的执行参数
debugInfo(['启动参数：{}', JSON.stringify(executeArguments)]) // 记录启动参数的调试信息
if (!executeArguments.intent || executeArguments.executeByDispatcher) { // 如果没有启动意图或由调度器执行
  commonFunctions.requestScreenCaptureOrRestart() // 请求截图权限或重启
  commonFunctions.ensureDeviceSizeValid() // 确保设备尺寸有效
}
if (!FloatyInstance.init()) { // 如果悬浮窗初始化失败
  runningQueueDispatcher.removeRunningTask() // 移除运行任务
  sleep(6000) // 休眠6秒
  runningQueueDispatcher.executeTargetScript(FileUtils.getRealMainScriptPath()) // 执行目标脚本
  exit() // 退出脚本
}
commonFunctions.autoSetUpBangOffset() // 自动设置刘海偏移量
commonFunctions.showDialogAndWait(true) // 显示对话框并等待
commonFunctions.listenDelayStart() // 监听延迟启动
if (config.develop_mode) { // 如果是开发模式
  mainExecutor.exec() // 执行主程序
} else {
  try {
    mainExecutor.exec() // 尝试执行主程序
  } catch (e) {
    commonFunctions.setUpAutoStart(1) // 设置一分钟后自动启动
    errorInfo('执行异常, 1分钟后重新开始' + e) // 记录执行异常的错误信息
    commonFunctions.printExceptionStack(e) // 打印异常堆栈信息
  }
}
if (config.auto_lock === true && unlocker.needRelock() === true) { // 如果配置自动锁屏且需要重新锁屏
  debugInfo('重新锁定屏幕') // 记录重新锁屏的调试信息
  automator.lockScreen() // 锁定屏幕
  unlocker.saveNeedRelock(true) // 保存需要重新锁屏的状态
}
FloatyInstance.close() // 关闭悬浮窗
flushAllLogs() // 刷新所有日志
runningQueueDispatcher.removeRunningTask(true) // 移除运行任务
exit() // 退出脚本
